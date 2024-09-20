from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import T5Tokenizer, T5ForConditionalGeneration
import torch

app = FastAPI(title="T5 Summarization API", description="Summarize large texts using T5 model.", version="1.0")

# Define the input schema
class TextInput(BaseModel):
    text: str

# Initialize the T5 tokenizer and model
MODEL_NAME = "t5-base"  # You can use "t5-large" for better performance if resources allow

try:
    tokenizer = T5Tokenizer.from_pretrained(MODEL_NAME)
    model = T5ForConditionalGeneration.from_pretrained(MODEL_NAME)
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = model.to(device)
except Exception as e:
    raise RuntimeError(f"Error loading the T5 model: {e}")

# Helper function to split text into chunks
def split_text(text, max_length=20):
    """
    Splits the input text into chunks of approximately max_length tokens.
    Ensures that chunks do not break sentences.
    """
    sentences = text.split('. ')
    chunks = []
    current_chunk = ""

    for sentence in sentences:
        if len(tokenizer.encode(current_chunk + sentence, truncation=True)) < max_length:
            current_chunk += sentence + '. '
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
            current_chunk = sentence + '. '

    if current_chunk:
        chunks.append(current_chunk.strip())

    return chunks

# Function to generate summary for a single chunk
def summarize_chunk(chunk):
    """
    Generates a summary for a single text chunk using T5.
    """
    try:
        input_text = "summarize specially the technical terms so that non technicals can understand: " + chunk
        input_ids = tokenizer.encode(input_text, return_tensors="pt", max_length=512, truncation=True).to(device)
        summary_ids = model.generate(
            input_ids,
            num_beams=4,
            max_length=150,  # Control length for chunk summaries
            min_length=50,   # Ensure a minimum length for better output
            length_penalty=2.0,
            early_stopping=True
        )
        summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        return summary
    except Exception as e:
        raise RuntimeError(f"Error during summarization: {e}")

# Endpoint to summarize text
@app.post("/summarize_text", summary="Summarize a large text input", response_description="The summary of the input text")
async def summarize_text(input: TextInput):
    text = input.text.strip()
    
    if not text:
        raise HTTPException(status_code=400, detail="Input text is empty.")
    
    # Split the text into manageable chunks
    chunks = split_text(text)
    
    if not chunks:
        raise HTTPException(status_code=400, detail="Unable to split text into chunks.")
    
    summaries = []
    try:
        for chunk in chunks:
            summary = summarize_chunk(chunk)
            summaries.append(summary)
        
        # Combine all summaries into a final summary
        combined_summary = " ".join(summaries)
        
        # Generate a final summary with max token count of approximately 300
        input_ids = tokenizer.encode(combined_summary, return_tensors="pt", max_length=512, truncation=True).to(device)
        summary_ids = model.generate(
            input_ids,
            num_beams=4,
            max_length=300,  # Ensure final summary does not exceed 300 tokens
            min_length=200,  # Ensure a reasonable length
            length_penalty=2.0,
            early_stopping=True
        )
        final_summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        
        return {"summary": final_summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
