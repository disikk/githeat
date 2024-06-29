#!/bin/bash

# Путь к вашему проекту
REPO_URL="https://github.com/disikk/githeat"
PROJECT_DIR="$HOME/githeat"
SERVICE_NAME="githeat"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# Функция для сравнения версий
version_gt() {
    test "$(printf '%s\n' "$@" | sort -V | head -n 1)" != "$1"
}

# Установка Git
if ! command -v git &> /dev/null
then
    echo "Git не найден. Установка Git..."
    sudo apt-get update
    sudo apt-get install -y git
else
    echo "Git уже установлен."
fi

# Клонирование репозитория
if [ ! -d "$PROJECT_DIR" ]; then
    echo "Клонирование репозитория..."
    git clone $REPO_URL $PROJECT_DIR
else
    echo "Репозиторий уже клонирован."
fi

# Проверка и установка Node.js и npm
if ! command -v node &> /dev/null || ! command -v npm &> /dev/null
then
    echo "Node.js или npm не найдены. Установка последней версии Node.js и npm..."
    curl -fsSL https://deb.nodesource.com/setup_current.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    CURRENT_VERSION=$(node -v | tr -d 'v')
    echo "Текущая версия Node.js: $CURRENT_VERSION"
    echo "Проверка наличия обновлений Node.js..."

    # Получение последней версии Node.js
    LATEST_VERSION=$(curl -sL https://deb.nodesource.com/setup_current.x | grep -oP 'VERSION="(\d+\.\d+\.\d+)"' | grep -oP '(\d+\.\d+\.\d+)' | head -1)

    if version_gt $LATEST_VERSION $CURRENT_VERSION; then
        echo "Обновление Node.js до версии $LATEST_VERSION..."
        curl -fsSL https://deb.nodesource.com/setup_current.x | sudo -E bash -
        sudo apt-get install -y nodejs
    else
        echo "Установлена последняя версия Node.js."
    fi
fi

# Переход в директорию проекта
cd "$PROJECT_DIR"

# Установка зависимостей
echo "Установка зависимостей..."
npm install

# Создание и запуск системного сервиса
if [ ! -f "$SERVICE_FILE" ]; then
    echo "Создание системного сервиса..."
    sudo bash -c "cat > ${SERVICE_FILE} <<EOF
[Unit]
Description=GitHub Committer Service
After=network.target

[Service]
WorkingDirectory=${PROJECT_DIR}
ExecStart=$(which npm) start
Restart=always
RestartSec=10
User=$(whoami)
Environment=PATH=/usr/bin:/usr/local/bin
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF"

    # Перезагрузка systemd
    sudo systemctl daemon-reload

    # Включение сервиса
    sudo systemctl enable ${SERVICE_NAME}

    echo "Сервис ${SERVICE_NAME} создан."
else
    echo "Сервис ${SERVICE_NAME} уже существует."
fi

# Создание алиасов для проверки логов и перезапуска сервиса
BASH_ALIASES=~/.bash_aliases
if ! grep -q "alias ${SERVICE_NAME}_logs" $BASH_ALIASES; then
    echo "Создание алиаса для проверки логов..."
    echo "alias ${SERVICE_NAME}_logs='sudo journalctl -u ${SERVICE_NAME} -fn 50 -o cat'" >> $BASH_ALIASES
    echo "Алиас ${SERVICE_NAME}_logs создан."
fi

if ! grep -q "alias ${SERVICE_NAME}_restart" $BASH_ALIASES; then
    echo "Создание алиаса для перезапуска сервиса..."
    echo "alias ${SERVICE_NAME}_restart='sudo systemctl restart ${SERVICE_NAME} && sudo journalctl -u ${SERVICE_NAME} -fn 50 -o cat'" >> $BASH_ALIASES
    echo "Алиас ${SERVICE_NAME}_restart создан."
fi

# Перезагрузка bash_aliases, чтобы алиасы стали доступны
source $BASH_ALIASES

echo "Вывод логов скрипта: ${SERVICE_NAME}_logs\nЗапуск/рестарт скрипта: ${SERVICE_NAME}_restart"
echo "Для конфигурации внесите изменения в файлах\n${HOME}/${PROJECT_DIR}/config.js\n${HOME}/${PROJECT_DIR}/data/accounts.json"