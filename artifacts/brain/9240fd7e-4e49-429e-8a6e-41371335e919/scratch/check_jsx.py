
import sys
import re

def check_jsx_balance(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Remove strings
    content = re.sub(r'"[^"]*"', '', content)
    content = re.sub(r"'[^']*'", '', content)
    # Remove comments
    content = re.sub(r'//.*', '', content)
    content = re.sub(r'/\*.*?\*/', '', content, flags=re.DOTALL)
    
    # Find tags
    tags = re.findall(r'</?([a-zA-Z0-9.]+)', content)
    
    stack = []
    for tag in tags:
        # Check if it's self-closing in the original content (heuristic)
        # We need a better regex for that
        pass

    # Simple count of specific tags
    div_open = len(re.findall(r'<div', content))
    div_close = len(re.findall(r'</div>', content))
    
    # Check for <div ... />
    div_self = len(re.findall(r'<div[^>]*/>', content))
    
    print(f"File: {filename}")
    print(f"  <div: {div_open}")
    print(f"  </div>: {div_close}")
    print(f"  <div ... />: {div_self}")
    print(f"  Balance: {div_open - div_close - div_self}")

check_jsx_balance(sys.argv[1])
