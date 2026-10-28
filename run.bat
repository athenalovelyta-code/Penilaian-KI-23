@echo off
title Sistem Penilaian Acara KI23
echo ===================================================
echo     MEMULAI SISTEM PENILAIAN ACARA KI23
echo ===================================================
echo Membuka server di http://127.0.0.1:8000 ...
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause
