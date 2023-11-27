@echo off

:loop
npm i
git pull
cls
node .

goto loop