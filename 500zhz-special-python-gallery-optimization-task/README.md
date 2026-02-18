# 500ZHZ - Python Gallery Pagination Optimization

## Test on repository_before
```bash
docker compose run --rm -e PYTHONPATH=/app/repository_before app pytest
```

## Test on repository_after
```bash
docker compose run --rm -e PYTHONPATH=/app/repository_after app pytest
```

## Generate Evaluation Report
```bash
docker compose run --rm app python evaluation/evaluation.py
```
