import os
import re
from langchain_ollama import OllamaLLM
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import PromptTemplate

# 1. Instantiate the Swarm
worker_llm = OllamaLLM(model="codegemma:7b-instruct")
manager_llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")

target_file = "metrix-mobile/app/(tabs)/chef.tsx"

def read_codebase(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()
    except Exception as e:
        return f"AGENT_READ_FAIL: {e}"

def overwrite_file(file_path, new_code):
    # Extract ONLY the code inside the markdown blocks, ignoring conversational fluff
    backticks = chr(96) * 3
    pattern = backticks + r'(?:tsx|typescript|javascript|js|react)?\n(.*?)\n' + backticks
    
    match = re.search(pattern, new_code, re.DOTALL | re.IGNORECASE)
    
    if match:
        clean_code = match.group(1).strip()
    else:
        clean_code = new_code.strip()
        
    try:
        with open(file_path, 'w', encoding='utf-8') as file:
            file.write(clean_code)
        print(f"\n✅ SYSTEM OVERRIDE SUCCESS: {file_path} has been securely updated.")
    except Exception as e:
        print(f"\n❌ FATAL I/O ERROR: Could not write to file. {e}")

# 2. Worker Protocol
worker_template = """
You are a junior developer. Review this code and identify any immediate syntax errors, missing imports, or basic bugs. Be concise.

Code:
{code}
"""
worker_prompt = PromptTemplate.from_template(worker_template)

# 3. Manager Protocol
manager_template = """
You are the Lead Full-Stack Engineer of the 'Metrix' fitness app. 
Your junior developer has reviewed a file and left some notes.

Original Code:
{code}

Junior Developer Notes:
{worker_notes}

Your Task:
Synthesize the junior developer's notes, apply your own senior-level React Native expertise, and provide the exact, optimized code block that should replace the original file. 
Ensure dark-mode styling and error handling are perfect.
OUTPUT ONLY THE RAW CODE. Do not include any conversational text before or after the code block.
"""
manager_prompt = PromptTemplate.from_template(manager_template)

def run_swarm():
    print(f"Swarm initialized. Reading {target_file}...\n")
    code_content = read_codebase(target_file)
    
    if code_content.startswith("AGENT_READ_FAIL"):
        print(code_content)
        return

    # Phase 1: Local Execution
    print("🤖 WORKER (CodeGemma Local) is analyzing the code...")
    worker_chain = worker_prompt | worker_llm
    worker_notes = worker_chain.invoke({"code": code_content})
    print("✅ Worker analysis complete.\n")

    # Phase 2: Cloud Execution
    print("🧠 MANAGER (Gemini 2.5 Flash) is reviewing notes and finalizing code...")
    manager_chain = manager_prompt | manager_llm
    final_output = manager_chain.invoke({
        "code": code_content, 
        "worker_notes": worker_notes
    })
    
    # Phase 3: Autonomy (Writing to Disk)
    print("💾 Manager is stripping conversational text and rewriting the codebase...")
    overwrite_file(target_file, final_output.content)

if __name__ == "__main__":
    run_swarm()