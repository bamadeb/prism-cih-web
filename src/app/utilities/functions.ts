export function onDomLoad(callBackFunc: () => void): void {
    setTimeout(() => {
        callBackFunc();
    }, 0);
}

export function GetUTC(): number {
    return Math.floor(Date.now() / 1000);
}
