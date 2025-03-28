# Category Mapping Tool

This application allows for easy mapping between Ozon and Wildberries categories with both exact and fuzzy matching capabilities.

## Running with Docker

The easiest way to run the application is using Docker Compose:

```bash
# Build and start the containers
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

After starting the containers, the application will be available at:
- Frontend: http://localhost
- Backend API: http://localhost:3000/api

## Running without Docker

If you prefer to run the application without Docker:

1. Start the backend server:
```bash
cd server
npm install
npm start
```

2. In a separate terminal, start the frontend:
```bash
python3 -m http.server 8000
```

3. Open http://localhost:8000 in your browser

## Using the Mapping Tool

1. Switch to the "Сопоставление категорий" tab
2. Choose the matching mode (exact or fuzzy)
3. If using fuzzy matching, adjust the similarity threshold
4. Click the auto-map button
5. Review the results and save if satisfied

## Features

- **Exact Matching**: Maps categories with identical names (case-insensitive)
- **Fuzzy Matching**: Maps categories based on name similarity with adjustable threshold
- **Server-side Processing**: Handles large datasets efficiently
- **Interactive UI**: Real-time feedback and progress indicators
- **Export/Import**: Save and load your mapping data
