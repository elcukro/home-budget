#!/bin/bash
cd /opt/home-budget/frontend
npm run build
pm2 restart firedup --update-env

