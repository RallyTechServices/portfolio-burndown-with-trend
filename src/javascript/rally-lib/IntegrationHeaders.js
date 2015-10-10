(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("Rally.apps.charts.IntegrationHeaders", {

        keyConverters : {
            name : function() { return 'X-RallyIntegrationName'; },
            vendor : function() { return 'X-RallyIntegrationVendor'; },
            platform : function() { return 'X-RallyIntegrationPlatform'; },
            os : function() { return 'X-RallyIntegrationOS'; },
            version : function() { return 'X-RallyIntegrationVersion'; },
            library : function() { return 'X-RallyIntegrationLibrary'; }
        },

        constructor: function(config) {
            this.headers = {
                name : 'A2 Chart',
                vendor : 'Rally Software'
            };

            Ext.merge(this.headers, config.integrationHeaders || {});
            this.callParent(config);
        },
        withName : function(nm) {
            this.headers.name = nm || this.headers.name;
            return this;
        },
        withVendor : function(v) {
            this.headers.vendor = v || this.headers.vendor;
            return this;
        },
        withPlatform : function(newPlatform) {
            this.headers.platform = newPlatform || this.headers.platform;
            return this;
        },
        withVersion : function(newVersion) {
            this.headers.version = newVersion || this.headers.version;
            return this;
        },
        withOS : function(newOS) {
            this.headers.os = newOS || this.headers.os;
            return this;
        },
        withLibrary : function(newLibrary) {
            this.headers.library = newLibrary || this.headers.library;
            return this;
        },
        applyTo : function(config) {
            config.headers = config.headers || {};
            Ext.merge(config.headers, this.build());
            return config;
        },
        build : function() {
            var h = {};
            for (var k in this.headers) {
                if (this.headers.hasOwnProperty(k)) {
                    if (this.headers[k] === null) { continue; }
                    var key = this._keyConverter(k)(k);
                    h[key] = this.headers[k];
                }
            }
            return h;
        },
        _keyConverter: function(key) {
            if (this.keyConverters.hasOwnProperty(key)) {
                return this.keyConverters[key];
            } else {
                return function(x) {return x;};
            }
        }
    });
}());