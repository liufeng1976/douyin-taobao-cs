@echo off
REM 配置 Windows 定时任务: 每分钟调用 AI 客服批量处理
schtasks /create /tn "AI-CustomerService-Batch" /tr "node %USERPROFILE%\Projects\douyin-taobao-cs\backend\batch-cron.js" /sc minute /mo 1 /f
echo 定时任务已创建: AI-CustomerService-Batch (每分钟执行)