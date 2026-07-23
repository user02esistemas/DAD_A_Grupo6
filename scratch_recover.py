import json
import os

transcript_path = r'C:\Users\lucre\.gemini\antigravity-ide\brain\70154cd5-851b-4999-b715-3bf0283e9a42\.system_generated\logs\transcript_full.jsonl'
files = {}

with open(transcript_path, 'r', encoding='utf-8') as f:
    for line in f:
        try:
            data = json.loads(line)
            if 'tool_calls' in data:
                for tc in data['tool_calls']:
                    name = tc.get('name', '')
                    args = tc.get('args', {})
                    if 'write_to_file' in name:
                        target = args.get('TargetFile')
                        content = args.get('CodeContent')
                        if target and content:
                            if 'mobile' in target and ('screens' in target or 'components' in target):
                                files[target] = content
            
            # Extract from view_file outputs
            if 'content' in data and data.get('source') == 'SYSTEM' and 'type' not in data:
                # the content is a string. Check if it looks like view_file output.
                pass
                
        except Exception as e:
            pass

os.makedirs(r'C:\Users\lucre\Proyecto-Restaurante\mobile\src\screens', exist_ok=True)
os.makedirs(r'C:\Users\lucre\Proyecto-Restaurante\mobile\src\components', exist_ok=True)

for path, content in files.items():
    print('Restoring from write_to_file', path)
    with open(path, 'w', encoding='utf-8') as out:
        out.write(content)
