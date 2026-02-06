/**
 * Gonkecutor - Frontend Application
 */

// State
let currentPath = '';
let selectedScript = null;
let selectedJobId = null;
let jobPollingInterval = null;

// DOM Elements
const fileList = document.getElementById('file-list');
const currentPathInput = document.getElementById('current-path');
const parentBtn = document.getElementById('parent-btn');
const refreshBtn = document.getElementById('refresh-btn');
const selectedFileDisplay = document.getElementById('selected-file');
const argsInput = document.getElementById('args-input');
const commandPreview = document.getElementById('command-preview');
const runBtn = document.getElementById('run-btn');
const outputContent = document.getElementById('output-content');
const clearOutputBtn = document.getElementById('clear-output');
const previewContent = document.getElementById('preview-content');
const previewFilename = document.getElementById('preview-filename');
const jobsList = document.getElementById('jobs-list');
const refreshJobsBtn = document.getElementById('refresh-jobs-btn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDirectory();
    setupEventListeners();
    setupKeyboardShortcuts();
    loadJobs();
    // Poll for job updates every 2 seconds
    jobPollingInterval = setInterval(loadJobs, 2000);
});

// Event Listeners
function setupEventListeners() {
    parentBtn.addEventListener('click', goToParent);
    refreshBtn.addEventListener('click', () => loadDirectory(currentPath));
    argsInput.addEventListener('input', updateCommandPreview);
    runBtn.addEventListener('click', runScript);
    clearOutputBtn.addEventListener('click', clearOutput);
    refreshJobsBtn.addEventListener('click', loadJobs);
}

// Keyboard Shortcuts
function setupKeyboardShortcuts() {
    // Ctrl + . to run script (global)
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === '.') {
            e.preventDefault();
            if (selectedScript && !runBtn.disabled) {
                runScript();
            }
        }
    });

    // Enter in arguments field to run script
    argsInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (selectedScript && !runBtn.disabled) {
                runScript();
            }
        }
    });
}

// Format file size
function formatSize(bytes) {
    if (bytes === null || bytes === undefined) return '';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Format time ago
function formatTimeAgo(timestamp) {
    const seconds = Math.floor(Date.now() / 1000 - timestamp);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// Get file icon
function getFileIcon(item) {
    if (item.is_dir) return '📁';
    if (item.is_python) return '🐍';

    const ext = item.name.split('.').pop().toLowerCase();
    const icons = {
        'js': '📜',
        'ts': '📜',
        'json': '📋',
        'html': '🌐',
        'css': '🎨',
        'md': '📝',
        'txt': '📄',
        'yml': '⚙️',
        'yaml': '⚙️',
        'toml': '⚙️',
        'sh': '💻',
        'bash': '💻',
        'png': '🖼️',
        'jpg': '🖼️',
        'jpeg': '🖼️',
        'gif': '🖼️',
        'svg': '🖼️',
        'pdf': '📕',
    };

    return icons[ext] || '📄';
}

// Load directory contents
async function loadDirectory(path = '') {
    fileList.innerHTML = '<div class="loading">Loading...</div>';

    try {
        const url = path ? `/api/browse?path=${encodeURIComponent(path)}` : '/api/browse';
        const response = await fetch(url);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load directory');
        }

        currentPath = data.current_path;
        currentPathInput.value = currentPath;

        renderFileList(data.items, data.parent);

    } catch (error) {
        fileList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">❌</div>
                <p>Error: ${error.message}</p>
            </div>
        `;
    }
}

// Render file list
function renderFileList(items, parentPath) {
    if (items.length === 0) {
        fileList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p>This directory is empty</p>
            </div>
        `;
        return;
    }

    fileList.innerHTML = '';

    items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'file-item';
        if (item.is_python) div.classList.add('is-python');
        if (selectedScript === item.path) div.classList.add('selected');

        div.innerHTML = `
            <span class="file-icon">${getFileIcon(item)}</span>
            <span class="file-name">${item.name}</span>
            <span class="file-size">${formatSize(item.size)}</span>
        `;

        div.addEventListener('click', () => handleItemClick(item));
        div.addEventListener('dblclick', () => handleItemDoubleClick(item));

        fileList.appendChild(div);
    });
}

// Handle item click
function handleItemClick(item) {
    if (item.is_dir) {
        loadDirectory(item.path);
    } else {
        selectFile(item);
        previewFile(item.path);
    }
}

// Handle item double click
function handleItemDoubleClick(item) {
    if (item.is_dir) {
        loadDirectory(item.path);
    } else if (item.is_python) {
        selectFile(item);
    }
}

// Select a file for execution
function selectFile(item) {
    if (!item.is_python) {
        return;
    }

    selectedScript = item.path;

    selectedFileDisplay.innerHTML = `
        <span class="file-icon">🐍</span>
        ${item.name}
    `;

    document.querySelectorAll('.file-item').forEach(el => {
        el.classList.remove('selected');
    });
    event.target.closest('.file-item')?.classList.add('selected');

    runBtn.disabled = false;
    updateCommandPreview();
}

// Update command preview
function updateCommandPreview() {
    if (!selectedScript) {
        commandPreview.textContent = 'uv run python <script> <args>';
        return;
    }

    const scriptName = selectedScript.split('/').pop();
    const args = argsInput.value.trim();

    let preview = `uv run python ${scriptName}`;
    if (args) {
        preview += ` ${args}`;
    }

    commandPreview.textContent = preview;
}

// Run the selected script
async function runScript() {
    if (!selectedScript) return;

    runBtn.disabled = true;
    runBtn.classList.add('running');
    runBtn.innerHTML = '<span class="run-icon">⏳</span> Starting...';
    outputContent.textContent = 'Starting job...';
    outputContent.className = 'output-content';

    try {
        const response = await fetch('/api/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                script: selectedScript,
                args: argsInput.value.trim(),
            }),
        });

        const data = await response.json();

        if (data.job_id) {
            selectedJobId = data.job_id;
            outputContent.textContent = `🚀 Job started: ${data.job_id}\nWaiting for completion...`;
            // Jobs will be refreshed by the polling interval
            loadJobs();
        }

    } catch (error) {
        outputContent.className = 'output-content error';
        outputContent.textContent = `❌ Error: ${error.message}`;
    } finally {
        runBtn.disabled = false;
        runBtn.classList.remove('running');
        runBtn.innerHTML = '<span class="run-icon">▶️</span> Run Script';
    }
}

// Load jobs list
async function loadJobs() {
    try {
        const response = await fetch('/api/jobs');
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load jobs');
        }

        renderJobsList(data.jobs);

        // If we have a selected job, update the output
        if (selectedJobId) {
            const job = data.jobs.find(j => j.id === selectedJobId);
            if (job) {
                updateOutputFromJob(job);
            }
        }

    } catch (error) {
        console.error('Failed to load jobs:', error);
    }
}

// Render jobs list
function renderJobsList(jobs) {
    if (jobs.length === 0) {
        jobsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">📭</div>
                <p>No jobs yet</p>
            </div>
        `;
        return;
    }

    jobsList.innerHTML = '';

    jobs.forEach(job => {
        const div = document.createElement('div');
        div.className = 'job-item';
        if (selectedJobId === job.id) div.classList.add('selected');

        div.innerHTML = `
            <div class="job-status ${job.status}"></div>
            <div class="job-info">
                <div class="job-script">${job.script}</div>
                <div class="job-args">${job.args || '(no args)'}</div>
            </div>
            <div class="job-time">${formatTimeAgo(job.started)}</div>
        `;

        div.addEventListener('click', () => selectJob(job));
        jobsList.appendChild(div);
    });
}

// Select a job to view its output
function selectJob(job) {
    selectedJobId = job.id;

    document.querySelectorAll('.job-item').forEach(el => {
        el.classList.remove('selected');
    });
    event.target.closest('.job-item')?.classList.add('selected');

    updateOutputFromJob(job);
}

// Update output display from job data
function updateOutputFromJob(job) {
    if (job.status === 'running') {
        outputContent.className = 'output-content';
        outputContent.textContent = `🚀 Job ${job.id} running...\n\nCommand: ${job.command}`;
    } else if (job.status === 'success') {
        outputContent.className = 'output-content success';
        outputContent.textContent = `✅ Exit code: ${job.returncode}\n\n`;
        if (job.stdout) {
            outputContent.textContent += `📤 STDOUT:\n${job.stdout}\n`;
        }
        if (job.stderr) {
            outputContent.textContent += `\n📥 STDERR:\n${job.stderr}`;
        }
    } else {
        outputContent.className = 'output-content error';
        outputContent.textContent = `❌ Exit code: ${job.returncode || 'N/A'}\n\n`;
        if (job.error) {
            outputContent.textContent += `Error: ${job.error}\n`;
        }
        if (job.stdout) {
            outputContent.textContent += `\n📤 STDOUT:\n${job.stdout}\n`;
        }
        if (job.stderr) {
            outputContent.textContent += `\n📥 STDERR:\n${job.stderr}`;
        }
    }
}

// Preview file contents
async function previewFile(path) {
    previewContent.innerHTML = '<div class="loading">Loading preview...</div>';
    previewFilename.textContent = '';

    try {
        const response = await fetch(`/api/preview?path=${encodeURIComponent(path)}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to load preview');
        }

        previewFilename.textContent = data.name;
        previewContent.textContent = data.content;

    } catch (error) {
        previewContent.innerHTML = `<span class="placeholder">Error: ${error.message}</span>`;
    }
}

// Go to parent directory
function goToParent() {
    if (currentPath) {
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
        loadDirectory(parentPath);
    }
}

// Clear output
function clearOutput() {
    selectedJobId = null;
    outputContent.textContent = '';
    outputContent.className = 'output-content';
}
