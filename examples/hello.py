#!/usr/bin/env python3
"""
Example script to test Gonkecutor.
Run with: uv run python hello.py [name]
"""

import sys


def main():
    if len(sys.argv) > 1:
        name = " ".join(sys.argv[1:])
        print(f"Hello, {name}! 👋")
    else:
        print("Hello, World! 🌍")
    
    print(f"\nArguments received: {sys.argv}")
    print(f"Script path: {sys.argv[0]}")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
