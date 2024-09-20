from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import T5Tokenizer, T5ForConditionalGeneration
import torch
from fastapi.middleware.cors import CORSMiddleware

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
def split_text(text, max_length=128):
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
            max_length=100,
            min_length=30,
            length_penalty=2.0,
            early_stopping=True
        )
        summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
        return summary
    except Exception as e:
        raise RuntimeError(f"Error during summarization: {e}")

origins = [
    "http://localhost:5173",  # Update with your frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # Include OPTIONS method
    allow_headers=["*"],
)




# Endpoint to summarize text
@app.post("/summarize_text", summary="Summarize a large text input", response_description="The summary of the input text")
async def summarize_text(input: TextInput):
    text = input.text.strip()
    # print(text)
    
    if not text:
        raise HTTPException(status_code=400, detail="Input text is empty.")
    
    # Split the text into manageable chunks
    chunks = split_text(text)
    print(chunks)
    if not chunks:
        raise HTTPException(status_code=400, detail="Unable to split text into chunks.")
    
    summaries = []
    try:
        for chunk in chunks:
            summary = summarize_chunk(chunk)
            print('here:')
            print(summary)
            summaries.append(summary)
        
        # Combine all summaries into a final summary
        combined_summary = " ".join(summaries)
        
        # Optionally, you can perform a second round of summarization on the combined summary
        final_summary = summarize_chunk(combined_summary)
        
        return {"summary": combined_summary}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
