import { definePluginSettings } from "@api/Settings";
import { getUserSettingLazy } from "@api/UserSettings";
import { Devs } from "@utils/constants";
import definePlugin, { OptionType, type PluginSettingComponentProps } from "@utils/types";
import { React } from "@webpack/common";
import type { ChangeEvent } from "react";

const StatusSettings = getUserSettingLazy<string>("status", "status")!;

let changedStatusForGame = false;

const IDLE_TIMEOUTS = [2, 5, 10, 15, 30, 60, 120, 180, 300, 420, 600] as const;
const DEFAULT_IDLE_TIMEOUT = 600;

function getIdleTimeoutIndex(value: number) {
    const index = IDLE_TIMEOUTS.indexOf(value as typeof IDLE_TIMEOUTS[number]);
    return index === -1 ? IDLE_TIMEOUTS.indexOf(DEFAULT_IDLE_TIMEOUT) : index;
}

function formatTimeout(seconds: number) {
    if (seconds < 60) return `${seconds}s`;

    const minutes = seconds / 60;
    return `${minutes}m`;
}

function IdleTimeoutSlider({ setValue }: PluginSettingComponentProps) {
    const value = Number(settings.store.idleTimeoutSeconds ?? DEFAULT_IDLE_TIMEOUT);
    const selectedIndex = getIdleTimeoutIndex(value);
    const handleChange = (event: ChangeEvent<HTMLInputElement>) =>
        setValue(IDLE_TIMEOUTS[Number(event.currentTarget.value)]);

    return (
        React.createElement("div", { style: { paddingTop: 8 } },
            React.createElement("div", {
                style: {
                    display: "flex",
                    justifyContent: "space-between",
                    marginBottom: 6,
                    fontSize: 12,
                    lineHeight: "16px",
                    color: "var(--text-muted)"
                }
            },
            IDLE_TIMEOUTS.map(seconds =>
                React.createElement("span", {
                    key: seconds,
                    style: {
                        width: 32,
                        textAlign: "center",
                        color: seconds === value ? "var(--text-normal)" : undefined
                    }
                }, formatTimeout(seconds))
            )),
            React.createElement("input", {
                type: "range",
                min: 0,
                max: IDLE_TIMEOUTS.length - 1,
                step: 1,
                value: selectedIndex,
                onChange: handleChange,
                style: {
                    width: "100%",
                    accentColor: "var(--brand-500)"
                }
            })
        )
    );
}

const settings = definePluginSettings({
    idleTimeoutSeconds: {
        description: "Seconds before Discord goes idle",
        type: OptionType.COMPONENT,
        component: IdleTimeoutSlider,
        default: DEFAULT_IDLE_TIMEOUT,
        restartNeeded: true
    },
    idleWhilePlaying: {
        type: OptionType.BOOLEAN,
        description: "Set status to idle while playing a game, but only if you were online",
        default: true
    },
    resetIdleOnStart: {
        type: OptionType.BOOLEAN,
        description: "Auto-change status from Idle to Online when Discord starts",
        default: true
    }
});

export default definePlugin({
    name: "NewIdle",
    description: "Sets a custom Discord idle timeout, switches to idle while playing, and resets idle on startup.",
    tags: ["Activity", "Utility", "Customisation"],
    authors: [Devs.newwares, Devs.thororen],
    settings,
    
    start() {
        if (settings.store.resetIdleOnStart) {
            const currentStatus = StatusSettings.getSetting();
            
            // Если при запуске клиент застрял в "неактивен", сбрасываем в "онлайн".
            // Если игра в этот момент запущена, последующее событие RUNNING_GAMES_CHANGE
            // само переведет статус обратно в "неактивен".
            if (currentStatus === "idle") {
                StatusSettings.updateSetting("online");
            }
        }
    },

    patches: [
        {
            find: 'type:"IDLE",idle:',
            replacement: [
                {
                    match: /(?<=Date\.now\(\)-\i>)\i\.\i\|\|/,
                    replace: "$self.getIdleTimeout()||"
                },
                {
                    match: /Math\.min\((\i\*\i\.\i\.\i\.SECOND),\i\.\i\)/,
                    replace: "$1"
                }
            ]
        }
    ],
    
    flux: {
        RUNNING_GAMES_CHANGE({ games }) {
            if (!settings.store.idleWhilePlaying) return;

            const hasRunningGame = games.length > 0;

            if (hasRunningGame) {
                // ОПТИМИЗАЦИЯ: Если мы уже перевели статус для текущей игры,
                // сразу прерываем функцию, чтобы не делать холостых проверок.
                if (changedStatusForGame) return;

                const status = StatusSettings.getSetting();
                
                // Переводим в idle только из чистого онлайна.
                if (status === "online") {
                    changedStatusForGame = true;
                    StatusSettings.updateSetting("idle");
                }
                return;
            }

            // Логика закрытия игры
            if (changedStatusForGame) {
                changedStatusForGame = false;
                
                const status = StatusSettings.getSetting();
                // Возвращаем онлайн, только если статус не был изменен пользователем вручную во время игры.
                if (status === "idle") {
                    StatusSettings.updateSetting("online");
                }
            }
        }
    },

    getIdleTimeout() {
        return settings.store.idleTimeoutSeconds * 1000;
    }
});
