@echo off
setlocal
cd /d "%~dp0"
echo Iniciando o Robo MkPipeline...
python -c "import dotenv, requests, playwright.sync_api" >nul 2>&1
if errorlevel 1 (
    echo ERRO: Python ou dependencias do robo nao encontrados.
    pause
    exit /b 1
)
python mk_pipeline.py
if errorlevel 1 (
    echo.
    echo Atualizacao com falha. Confira as mensagens acima.
    pause
    exit /b 1
)
echo.
echo Processo finalizado com sucesso!
pause
