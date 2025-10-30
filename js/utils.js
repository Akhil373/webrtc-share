export function getUserDetails() {
    const userAgent = navigator.userAgent;
    const platform = navigator.platform || "";
    const userAgentData = navigator.userAgentData;

    let OSName = "Unknown OS";
    let browserName = "Unknown Browser";
    let deviceType = "Desktop";

    const isMobile =
        /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
            userAgent,
        );
    const isTablet = /iPad|Android(?!.*Mobile)|Tablet/i.test(userAgent);

    if (isTablet) deviceType = "Tablet";
    else if (isMobile) deviceType = "Mobile";

    if (userAgent.indexOf("Windows NT 10.0") !== -1) OSName = "Windows 10/11";
    else if (userAgent.indexOf("Windows NT 6.3") !== -1) OSName = "Windows 8.1";
    else if (userAgent.indexOf("Windows NT 6.2") !== -1) OSName = "Windows 8";
    else if (userAgent.indexOf("Windows NT 6.1") !== -1) OSName = "Windows 7";
    else if (userAgent.indexOf("Win") !== -1) OSName = "Windows";
    else if (userAgent.indexOf("Mac OS X") !== -1) {
        const macVersion = userAgent.match(/Mac OS X (\d+[._]\d+)/);
        OSName = macVersion ? `macOS ${macVersion[1].replace("_", ".")}` : "macOS";
    } else if (userAgent.indexOf("Android") !== -1) {
        const androidVersion = userAgent.match(/Android (\d+(\.\d+)?)/);
        OSName = androidVersion ? `Android ${androidVersion[1]}` : "Android";
    } else if (/iPad|iPhone|iPod/.test(userAgent)) {
        const iOSVersion = userAgent.match(/OS (\d+_\d+)/);
        OSName = iOSVersion ? `iOS ${iOSVersion[1].replace("_", ".")}` : "iOS";
    } else if (userAgent.indexOf("CrOS") !== -1) OSName = "ChromeOS";
    else if (userAgent.indexOf("Linux") !== -1 || userAgent.indexOf("X11") !== -1)
        OSName = "Linux";

    if (userAgent.indexOf("Edg") !== -1) browserName = "Edge";
    else if (userAgent.indexOf("OPR") !== -1 || userAgent.indexOf("Opera") !== -1)
        browserName = "Opera";
    else if (userAgent.indexOf("Chrome") !== -1) browserName = "Chrome";
    else if (userAgent.indexOf("Safari") !== -1) browserName = "Safari";
    else if (userAgent.indexOf("Firefox") !== -1) browserName = "Firefox";
    else if (
        userAgent.indexOf("MSIE") !== -1 ||
        userAgent.indexOf("Trident") !== -1
    )
        browserName = "IE";

    const deviceName = `${OSName} ${deviceType} (${browserName})`;

    return {
        os: OSName,
        browser: browserName,
        deviceType: deviceType,
        deviceName: deviceName,
        userAgent: userAgent,
    };
}

let wakeLock = null;

export async function requestLock() {
    if (!("wakeLock" in navigator)) {
        console.warn("Wake lock is not supported.");
        return;
    }
    try {
        wakeLock = await navigator.wakeLock.request("screen");
        wakeLock.addEventListener("release", () => console.log("wakeLock lost."));
    } catch (err) {
        console.error("wake lock failed: ", err);
    }
}

export function releaseLock() {
    wakeLock?.release().then(() => (wakeLock = null));
}
