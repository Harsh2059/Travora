import json

with open(r"C:\Users\Aditya Pathak\.gemini\antigravity-ide\brain\fe8adf1c-5e28-4733-b030-9c8cc44c28ea\.system_generated\steps\235\content.md", "r", encoding="utf-8") as f:
    lines = f.readlines()
    data = json.loads(lines[4].strip())

paths = data.get("paths", {})
with open("paths_summary.txt", "w", encoding="utf-8") as f:
    for path, methods in paths.items():
        if "disruption" in path or "impact" in path or "recovery" in path:
            f.write(f"Path: {path}\n")
            for method, details in methods.items():
                f.write(f"  Method: {method.upper()}\n")
                # write requestBody
                req_body = details.get("requestBody", {})
                if req_body:
                    schema = req_body.get("content", {}).get("application/json", {}).get("schema", {})
                    f.write(f"    Req Schema: {schema}\n")
                # write responses
                resps = details.get("responses", {})
                for status, r_det in resps.items():
                    schema = r_det.get("content", {}).get("application/json", {}).get("schema", {})
                    f.write(f"    Res {status} Schema: {schema}\n")
            f.write("\n")
