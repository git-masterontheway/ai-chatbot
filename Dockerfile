FROM python:3.12-slim

WORKDIR /app

# Install dependencies
COPY ai_integration/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy DocVerse AI Frontend & Backend codebase
COPY . .

# Set default cloud deployment port (Render sets $PORT dynamically)
ENV PORT=10000
ENV HOST=0.0.0.0

EXPOSE 10000

CMD ["python", "ai_integration/gemini_web2api.py"]
