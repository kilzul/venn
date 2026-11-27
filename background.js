chrome.action.onClicked.addListener(async () => {
    const { windowId } = await chrome.storage.session.get("windowId");

    if (windowId !== undefined) {
        try {
            await chrome.windows.update(windowId, { focused: true });
            return;
        } catch (error) {
            // that window was closed, so fall through and open a new one
        }
    }

    const win = await chrome.windows.create({
        url: "index.html",
        type: "popup",
        width: 460,
        height: 560
    });
    await chrome.storage.session.set({ windowId: win.id });
});