# 🚀 Gonkecutor

A sleek web-based file browser for running Python scripts with custom arguments.

![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-3.0+-green.svg)

## Features

- 📁 **File Browser** - Navigate your filesystem with a modern, dark-themed UI
- 🐍 **Python Script Runner** - Click on any `.py` file to select and run it
- ⚡ **Custom Arguments** - Pass command-line arguments via text input
- 👁️ **File Preview** - View file contents before running
- 🎨 **Premium Dark Theme** - Beautiful glassmorphism design with subtle animations

## Quick Start

```bash
# Navigate to the project
cd gonkecutor

# Run with uv
uv run python app.py

# Or run with a custom directory to browse
uv run python app.py /path/to/your/project
```

Then open [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser.

## How It Works

1. **Browse** - Navigate through your files in the left panel
2. **Select** - Click on a `.py` file to select it
3. **Configure** - Enter any arguments in the text input
4. **Execute** - Click "Run Script" to execute: `uv run python <script> <args>`
5. **Review** - See the output in the execution panel

## Example Usage

If you have a script `my_script.py` that takes arguments:

```python
# my_script.py
import sys
print(f"Arguments received: {sys.argv[1:]}")
```

1. Click on `my_script.py` in the file browser
2. Enter `--input file.txt --verbose` in the arguments field
3. Click "Run Script"
4. The command `uv run python my_script.py --input file.txt --verbose` will be executed

## Tech Stack

- **Backend**: Flask (Python)
- **Frontend**: Vanilla HTML/CSS/JS
- **Executor**: Uses `uv run python` for script execution

## License

MIT
