import os
import re

dir_path = "/home/ashwin_m/.gemini/antigravity/scratch/Hiring-Portal/onegt-release-OneGT_MVP_0.1/frontend/src/modules/talent"
pattern = re.compile(r"(['\"])@/modules/talent/([^'\"]*)(['\"])")

count = 0
for root, _, files in os.walk(dir_path):
    for f in files:
        if f.endswith(('.ts', '.tsx', '.js', '.jsx')):
            filepath = os.path.join(root, f)
            with open(filepath, 'r', encoding='utf-8') as file:
                content = file.read()
            
            new_content = pattern.sub(r"\1@/\2\3", content)
            
            if new_content != content:
                with open(filepath, 'w', encoding='utf-8') as file:
                    file.write(new_content)
                count += 1
                print(f"Reverted {filepath}")

print(f"\nTotal files reverted: {count}")
