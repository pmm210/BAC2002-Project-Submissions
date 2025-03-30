FROM python:3.8-slim

RUN pip install --no-cache-dir "numpy<1.24.0" "scikit-learn<1.1.0" "pandas<1.6.0" "tensorflow-cpu<2.13.0" "requests<2.32.0" "flask<2.3.0" "websocket-client"

WORKDIR /app

COPY . .

EXPOSE 8000

CMD ["python", "client.py"]