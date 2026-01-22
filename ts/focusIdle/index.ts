import definePlugin from "@utils/types";
import { FluxDispatcher } from "@webpack/common";
const IDLE_TIMEOUT = 2000;
let timeoutId: NodeJS.Timeout | null = null;
export default definePlugin({
    name: "FocusIdle",
    description: "Sets status to 'Idle' when Discord window loses focus (preserves activity)",
    authors: [{ name: "Me", id: 0n }],
    patches: [
        {
            find: 'type:"IDLE",idle:',
            replacement: [
                {
                    match: /(?<=Date\.now\(\)-\i>)\i\.\i\|\|/,
                    replace: "Infinity||"
                },
                {
                    match: /Math\.min\((\i\*\i\.\i\.\i\.SECOND),\i\.\i\)/,
                    replace: "$1"
                },
                {
                    match: /\i\.\i\.dispatch\({type:"IDLE",idle:!1}\)/,
                    replace: "FluxDispatcher.dispatch({type:\"IDLE\",idle:false})"
                }
            ]
        }
    ],
    start() {
        const onBlur = () => {
            if (timeoutId) clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                FluxDispatcher.dispatch({
                    type: "IDLE",
                    idle: true
                });
            }, IDLE_TIMEOUT);
        };
        const onFocus = () => {
            if (timeoutId) clearTimeout(timeoutId);
            FluxDispatcher.dispatch({
                type: "IDLE",
                idle: false
            });
        };
        window.addEventListener("blur", onBlur);
        window.addEventListener("focus", onFocus);
        (this as any)._cleanup = () => {
            window.removeEventListener("blur", onBlur);
            window.removeEventListener("focus", onFocus);
            if (timeoutId) clearTimeout(timeoutId);
        };
    },
    stop() {
        (this as any)._cleanup?.();
    }
});
