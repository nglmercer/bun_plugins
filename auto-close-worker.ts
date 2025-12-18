
            declare var self: Worker;
            self.postMessage("ready");
            // Exit immediately
            setTimeout(() => process.exit(0), 10);
        