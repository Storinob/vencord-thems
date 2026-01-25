import { currentNotice, noticesQueue, popNotice, showNotice } from "@api/Notices";
import { definePluginSettings } from "@api/Settings";
import { Devs } from "@utils/constants";
import definePlugin, { makeRange, OptionType } from "@utils/types";
import { FluxDispatcher } from "@webpack/common";
const settings = definePluginSettings({
    idleTimeout: {
        description: "Seconds before Discord goes idle (0 = never)",
        type: OptionType.SLIDER,
        markers: makeRange(0, 30, 1),
        default: 5,
        stickToMarkers: true
    },
    remainInIdle: {
        description: "Require confirmation before returning online",
        type: OptionType.BOOLEAN,
        default: true
    }
});
let isWindowFocused = true;
let blurTimeout: number | null = null;
function getIdleDelayMs(): number | null {
    const seconds = settings.store.idleTimeout;
    return seconds === 0 ? null : seconds * 1000;
}
const onFocus = () => {
    isWindowFocused = true;
    if (blurTimeout) {
        clearTimeout(blurTimeout);
        blurTimeout = null;
    }
};
const onBlur = () => {
    isWindowFocused = false;
    if (blurTimeout) {
        clearTimeout(blurTimeout);
        blurTimeout = null;
    }
    const delay = getIdleDelayMs();
    if (delay == null) return;
    blurTimeout = setTimeout(() => {
        FluxDispatcher.dispatch({ type: "IDLE", idle: true });
    }, delay);
};
export default definePlugin({
    name: "CustomIdle2",
    description: "Switching to Idle when inactive or unfocus Discord window and then returning",
    //authors: [Devs.],
    settings,
    patches: [
        {
            find: 'type:"IDLE",idle:',
            replacement: [
                {
                    match: /(?<=Date\.now\(\)-\i>)\i\.\i\|\|/,
                    replace: "$self.getIdleTimeout()||"
                },
                {
                    match: /\i\.\i\.dispatch\({type:"IDLE",idle:!1}\)/,
                    replace: "$self.handleOnline()"
                }
            ]
        }
    ],
    start() {
        window.addEventListener("focus", onFocus);
        window.addEventListener("blur", onBlur);
    },
    stop() {
        if (blurTimeout) clearTimeout(blurTimeout);
        window.removeEventListener("focus", onFocus);
        window.removeEventListener("blur", onBlur);
    },
    handleOnline() {
        if (!isWindowFocused) return;
        if (!settings.store.remainInIdle) {
            FluxDispatcher.dispatch({ type: "IDLE", idle: false });
            return;
        }
        const message =
            "You are back. Click to go online, or close to remain idle.";
        if (
            currentNotice?.[1] === message ||
            noticesQueue.some(([, m]) => m === message)
        ) return;
        showNotice(message, "Go online", () => {
            popNotice();
            FluxDispatcher.dispatch({ type: "IDLE", idle: false });
        });
    },
    getIdleTimeout() {
        const seconds = settings.store.idleTimeout;
        return seconds === 0
            ? 0x7fffffff
            : seconds * 1000;
    }
});
