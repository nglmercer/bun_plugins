export function checkNetworkPermission(
    pluginName: string, 
    permissions: string[] | undefined, 
    allowedDomains: string[] | undefined, 
    urlStr: string
): void {
    if (!permissions?.includes('network')) {
        throw new Error(`AccessDenied: Plugin '${pluginName}' requires 'network' permission.`);
    }

    if (allowedDomains && allowedDomains.length > 0) {
        let url: URL;
        try {
            url = new URL(urlStr);
        } catch (e) {
            // If URL is invalid, we block it just in case
            throw new Error(`AccessDenied: Invalid URL '${urlStr}' for plugin '${pluginName}'.`);
        }

        const hostname = url.hostname;
        const isAllowed = allowedDomains.some(domain => 
            hostname === domain || hostname.endsWith('.' + domain)
        );

        if (!isAllowed) {
            throw new Error(`AccessDenied: Domain '${hostname}' is not in allowedDomains for plugin '${pluginName}'.`);
        }
    }
}

export function checkPermission(
    pluginName: string, 
    permissions: string[] | undefined, 
    perm: 'filesystem' | 'env'
): void {
    if (!permissions?.includes(perm)) {
        throw new Error(`AccessDenied: Plugin '${pluginName}' requires '${perm}' permission.`);
    }
}
