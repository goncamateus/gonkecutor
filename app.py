"""
Gonkecutor - A web-based file browser for running Python scripts
"""

import os
import subprocess
import shlex
import uuid
import threading
import time
from pathlib import Path
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Default directory to browse (user's home directory)
BASE_DIR = Path.home()

# Job tracking
jobs = {}  # {job_id: {status, script, args, started, finished, stdout, stderr, returncode}}


def get_file_info(path: Path) -> dict:
    """Get file/directory information."""
    try:
        stat = path.stat()
        return {
            "name": path.name,
            "path": str(path.absolute()),
            "is_dir": path.is_dir(),
            "is_python": path.suffix == ".py",
            "size": stat.st_size if path.is_file() else None,
            "modified": stat.st_mtime,
        }
    except (PermissionError, OSError):
        return None


@app.route("/")
def index():
    """Render the main file browser page."""
    return render_template("index.html")


@app.route("/api/browse")
def browse():
    """Browse a directory and return its contents."""
    path = request.args.get("path", str(BASE_DIR))
    
    try:
        dir_path = Path(path).resolve()
        
        if not dir_path.exists():
            return jsonify({"error": "Path does not exist"}), 404
        
        if not dir_path.is_dir():
            return jsonify({"error": "Path is not a directory"}), 400
        
        # Get parent directory
        parent = str(dir_path.parent) if dir_path.parent != dir_path else None
        
        # List directory contents
        items = []
        try:
            for item in sorted(dir_path.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower())):
                # Skip hidden files and folders
                if item.name.startswith('.'):
                    continue
                info = get_file_info(item)
                if info:
                    items.append(info)
        except PermissionError:
            return jsonify({"error": "Permission denied"}), 403
        
        return jsonify({
            "current_path": str(dir_path),
            "parent": parent,
            "items": items,
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


def truncate_output(text, max_lines=20):
    """Limit output to max_lines."""
    lines = text.splitlines(keepends=True)
    if len(lines) > max_lines:
        return ''.join(lines[:max_lines]) + f"\n... (truncated, showing first {max_lines} of {len(lines)} lines)"
    return text


def execute_job(job_id, script, args, cmd):
    """Execute a job in background thread."""
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minute timeout
            cwd=script.parent,
        )
        
        jobs[job_id].update({
            "status": "success" if result.returncode == 0 else "failed",
            "finished": time.time(),
            "returncode": result.returncode,
            "stdout": truncate_output(result.stdout),
            "stderr": truncate_output(result.stderr),
        })
    
    except subprocess.TimeoutExpired:
        jobs[job_id].update({
            "status": "failed",
            "finished": time.time(),
            "error": "Script execution timed out (5 min limit)",
        })
    except Exception as e:
        jobs[job_id].update({
            "status": "failed",
            "finished": time.time(),
            "error": str(e),
        })


@app.route("/api/run", methods=["POST"])
def run_script():
    """Run a Python script with the given arguments (async)."""
    data = request.json
    script_path = data.get("script")
    args = data.get("args", "")
    
    if not script_path:
        return jsonify({"error": "No script specified"}), 400
    
    script = Path(script_path)
    
    if not script.exists():
        return jsonify({"error": "Script does not exist"}), 404
    
    if not script.suffix == ".py":
        return jsonify({"error": "Not a Python file"}), 400
    
    # Build the command
    cmd = ["uv", "run", "python", str(script)]
    
    # Parse and add arguments safely
    if args.strip():
        cmd.extend(shlex.split(args))
    
    # Create job
    job_id = str(uuid.uuid4())[:8]
    jobs[job_id] = {
        "id": job_id,
        "status": "running",
        "script": script.name,
        "script_path": str(script),
        "args": args,
        "command": " ".join(cmd),
        "started": time.time(),
        "finished": None,
        "returncode": None,
        "stdout": "",
        "stderr": "",
        "error": None,
    }
    
    # Run in background thread
    thread = threading.Thread(target=execute_job, args=(job_id, script, args, cmd))
    thread.daemon = True
    thread.start()
    
    return jsonify({"job_id": job_id, "status": "running"})


@app.route("/api/jobs")
def list_jobs():
    """List all jobs."""
    # Return jobs sorted by start time (newest first), limited to last 5
    sorted_jobs = sorted(jobs.values(), key=lambda x: x["started"], reverse=True)[:5]
    return jsonify({"jobs": sorted_jobs})


@app.route("/api/jobs/<job_id>")
def get_job(job_id):
    """Get a specific job's status and output."""
    if job_id not in jobs:
        return jsonify({"error": "Job not found"}), 404
    return jsonify(jobs[job_id])


@app.route("/api/preview")
def preview_file():
    """Preview the contents of a file."""
    path = request.args.get("path")
    
    if not path:
        return jsonify({"error": "No path specified"}), 400
    
    file_path = Path(path)
    
    if not file_path.exists():
        return jsonify({"error": "File does not exist"}), 404
    
    if not file_path.is_file():
        return jsonify({"error": "Not a file"}), 400
    
    try:
        # Limit preview size
        max_size = 100 * 1024  # 100KB
        if file_path.stat().st_size > max_size:
            content = file_path.read_text(errors="replace")[:max_size]
            content += "\n\n... (file truncated)"
        else:
            content = file_path.read_text(errors="replace")
        
        return jsonify({
            "content": content,
            "path": str(file_path),
            "name": file_path.name,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    import sys
    
    # Allow passing a custom directory
    if len(sys.argv) > 1:
        custom_dir = Path(sys.argv[1]).resolve()
        if custom_dir.is_dir():
            BASE_DIR = custom_dir
            print(f"Browsing: {BASE_DIR}")
    
    print(f"Starting Gonkecutor - browsing {BASE_DIR}")
    # Bind to 0.0.0.0 to allow Docker access
    app.run(debug=True, host="0.0.0.0", port=5000)
