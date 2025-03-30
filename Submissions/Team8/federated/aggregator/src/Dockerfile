FROM python:3.8-slim

# Install required Python packages including websocket-client
RUN pip install --no-cache-dir numpy pandas tensorflow-cpu requests websocket-client

WORKDIR /app

COPY . .

CMD ["python", "aggregator.py"]
