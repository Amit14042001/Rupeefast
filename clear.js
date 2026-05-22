async function clearEverything() {
    // Unregister Service Workers
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
        await registration.unregister();
    }
    
    // Clear Cache storage
    if (window.caches) {
        const cacheNames = await caches.keys();
        for (const cacheName of cacheNames) {
            await caches.delete(cacheName);
        }
    }
    
    // localStorage and sessionStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // IndexedDB - might be hard to list all if I don't know the names, 
    // but clearing often solves common persistence issues.
    // IndexedDB is a bit more complex, but usually not the cause of rendering issues.
    
    console.log("Everything cleared.");
    return "success";
}
clearEverything().then(console.log);
