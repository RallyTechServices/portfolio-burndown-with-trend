(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("Rally.apps.charts.rpm.PortfolioChartAppBase", {
        extend: "Rally.app.App",
        settingsScope: "workspace",
        logger: new Rally.technicalservices.Logger(),
    
        requires: [
            'Rally.apps.charts.rpm.ChartSettings',
            'Rally.ui.combobox.ComboBox',
            'Rally.util.Test',
            'Deft.Deferred'
        ],
    
        mixins: [
            'Rally.apps.charts.DateMixin'
        ],
    
        scheduleStates: ["Defined", "In-Progress", "Completed", "Accepted"],
    
        PI_SETTING: "portfolioItemPicker",
    
        items: [
            {
                xtype: 'container',
                itemId: 'header',
                cls: 'header'
            }
        ],
        integrationHeaders : {
            name : "Portfolio Chart"
        },
    
        getSettingsFields: function () {
            return this.chartSettings.getSettingsConfiguration();
        },
    
        clientMetrics: {
            beginEvent: 'updateBeforeRender',
            endEvent: 'updateAfterRender',
            description: 'pichartapp - elapsed chart load'
        },
    
        launch: function () {
            this._setupEvents();
    
            this._setupChartSettings();
    
            this._setDefaultConfigValues();
            this._setupUpdateBeforeRender();
    
            this._loadSavedPortfolioItem();
            Ext.create('Rally.apps.charts.IntegrationHeaders',this).applyTo(this.chartComponentConfig.storeConfig);
        },
    
        _setupChartSettings: function () {
            this.chartSettings = Ext.create("Rally.apps.charts.rpm.ChartSettings", {
                app: this
            });
        },
    
        _setupUpdateBeforeRender: function () {
            this.chartComponentConfig.updateBeforeRender = this._setupDynamicHooksWithEvents(
                this.chartComponentConfig.updateBeforeRender,
                'updateBeforeRender'
            );
    
            this.chartComponentConfig.updateAfterRender = this._setupDynamicHooksWithEvents(
                this.chartComponentConfig.updateAfterRender,
                'updateAfterRender'
            );
        },
    
        _setupDynamicHooksWithEvents: function (func, event) {
            var self = this;
    
            return function () {
                self.fireEvent(event);
                if ('function' === typeof func) {
                    func.apply(this);
                }
            };
        },
    
        _setupEvents: function () {
            this.addEvents(
                'updateBeforeRender',
                'updateAfterRender'
            );
        },
    
        _setDefaultConfigValues: function () {
            var config = Ext.clone(this.chartComponentConfig);
    
            config.storeConfig.find = config.storeConfig.find || {};
    
            config.calculatorConfig = config.calculatorConfig || {};
    
            config.chartConfig = config.chartConfig || {};
            config.chartConfig.title = config.chartConfig.title || {};
            config.chartConfig.xAxis = config.chartConfig.xAxis || {};
            config.chartConfig.xAxis.type = config.chartConfig.xAxis.type || "datetime";
            config.chartConfig.yAxis = config.chartConfig.yAxis || [
                {
                    title: {}
                }
            ];
    
            this.chartComponentConfig = config;
        },
    
    
        _loadSavedPortfolioItem: function () {
            if (!this._validateSettingsChoices()) {
                // force pop up the settings
                
                if ( this.isExternal() ) {
                    return;
                }
                return this.showSettings();
            }
    
            var portfolioItemRef = this.getSetting(this.PI_SETTING);
            var store = Ext.create("Rally.data.wsapi.Store", {
                model: Ext.identityFn("Portfolio Item"),
                filters: [
                    {
                        property: "ObjectID",
                        operator: "=",
                        value: Rally.util.Ref.getOidFromRef(portfolioItemRef)
                    }
                ],
                context: {
                    workspace: this.getContext().getWorkspaceRef(),
                    project: null
                },
                scope: this
            });
    
            store.on('load', this._onPortfolioItemRetrieved, this);
            store.load();
        },
    
        _validateSettingsChoices: function () {
            this.logger.log('_validateSettingsChoices');
            var piRef = this._getSettingPortfolioItem(),
                startDate = this._getSettingStartDate(),
                endDate = this._getSettingEndDate(),
                dataType = this.getSetting("chartAggregationType"),
                invalid = function (value) {
                    return !value || value === "undefined";
                };
    
            if (invalid(piRef) || invalid(startDate) || invalid(endDate) || invalid(dataType)) {
                return false;
            }
            return true;
        },
    
        /*
         * when running externally, the setting of arrays is sometimes stored as arrays
         * when running internally, the setting of arrays is sometimes stored as strings
         */
        _getSettingStartDate: function() {
            this.logger.log('startdate setting:', this.getSetting('startdate'));
            this.logger.log('settings:', this.getSettings());
            var start_date = this.getSetting("startdate") || this.getSetting("startDate");
            if ( Ext.isArray(start_date) ) {
                start_date = start_date.join(',');
            }
            return start_date;
        },
    
        _getSettingEndDate: function() {
            var end_date = this.getSetting("enddate") || this.getSetting("endDate");
            if ( Ext.isArray(end_date) ) {
                end_date = end_date.join(',');
            }
            return end_date;
        },
    
        _getSettingPortfolioItem: function() {
            var currentSetting = this.getSetting(this.PI_SETTING);
            if(currentSetting && currentSetting !== "undefined") {
                return currentSetting;
            }
    
            var previousSetting = this.getSetting("buttonchooser");
            if (previousSetting && previousSetting !== "undefined") {
                return Ext.JSON.decode(previousSetting).artifact._ref;
            }
    
            return "undefined";
        },
    
        _savedPortfolioItemValid: function (savedPi) {
            return !!(savedPi && savedPi._type && savedPi.ObjectID && savedPi.Name);
        },
    
        _onPortfolioItemRetrieved: function (store) {
            this.logger.log('_onPortfolioItemRetrieved', store);
            
            var storeData = store.getAt(0),
                portfolioItemRecord = storeData.data;
    
            if (!this._savedPortfolioItemValid(portfolioItemRecord)) {
                this._portfolioItemNotValid();
                return;
            }
    
            if (portfolioItemRecord) {
                Rally.data.ModelFactory.getModel({
                    type: 'UserStory',
                    success: function (model) {
                        this._onUserStoryModelRetrieved(model, portfolioItemRecord);
                    },
                    scope: this
                });
            } else {
                this._setErrorTextMessage("A server error occurred, please refresh the page.");
            }
        },
    
        _onUserStoryModelRetrieved: function (model, portfolioItem) {
            var scheduleStateValues = model.getField('ScheduleState').getAllowedStringValues();
            this.chartComponentConfig.calculatorConfig.scheduleStates = scheduleStateValues;
    
            this._setDynamicConfigValues(portfolioItem);
            this._calculateDateRange(portfolioItem);
            this._updateQueryConfig(portfolioItem);
    
            this.add(this.chartComponentConfig);
            //Rally.environment.getMessageBus().publish(Rally.Message.piChartAppReady);
        },
    
        _setDynamicConfigValues: function (portfolioItem) {
            this._updateChartConfigDateFormat();
            this.chartComponentConfig.chartConfig.title = this._buildChartTitle(portfolioItem);
            this.chartComponentConfig.chartConfig.subtitle = this._buildChartSubtitle(portfolioItem);
    
            this.chartComponentConfig.calculatorConfig.chartAggregationType = this._getAggregationType();
            this.chartComponentConfig.chartConfig.yAxis[0].title.text = this._getYAxisTitle();
    
            this.chartComponentConfig.chartConfig.yAxis[0].labels = {
                x: -5,
                y: 4
            };
        },
    
        _updateChartConfigDateFormat: function () {
            var self = this;
    
            this.chartComponentConfig.chartConfig.xAxis.labels = {
                x: 0,
                y: 20,
                formatter: function () {
                    return self._formatDate(self.dateStringToObject(this.value));
                }
            };
        },
    
        _parseRallyDateFormatToHighchartsDateFormat: function () {
            var dateFormat = this._getUserConfiguredDateFormat() || this._getWorkspaceConfiguredDateFormat();
    
            for (var i = 0; i < this.dateFormatters.length; i++) {
                dateFormat = dateFormat.replace(this.dateFormatters[i].key, this.dateFormatters[i].value);
            }
    
            return dateFormat;
        },
    
        _formatDate: function (date) {
            
            if (!this.dateFormat) {
                this.dateFormat = this._parseRallyDateFormatToHighchartsDateFormat();
            }
            
            return Highcharts.dateFormat(this.dateFormat, date.getTime());
        },
    
        _calculateDateRange: function (portfolioItem) {
            var calcConfig = this.chartComponentConfig.calculatorConfig;
            calcConfig.startDate = calcConfig.startDate || this._getChartStartDate(portfolioItem);
            calcConfig.endDate = calcConfig.endDate || this._getChartEndDate(portfolioItem);
            calcConfig.timeZone = calcConfig.timeZone || this._getTimeZone();
            calcConfig.PI = portfolioItem;
            this.chartComponentConfig.chartConfig.xAxis.tickInterval = this._configureChartTicks(calcConfig.startDate, calcConfig.endDate);
        },
    
        _updateQueryConfig: function (portfolioItem) {
            this.chartComponentConfig.storeConfig.find._ItemHierarchy = portfolioItem.ObjectID;
        },
    
        _configureChartTicks: function (startDate, endDate) {
            var pixelTickWidth = 125,
                appWidth = this.getWidth(),
                ticks = Math.floor(appWidth / pixelTickWidth);
    
            var startDateObj = this.dateStringToObject(startDate),
                endDateObj = this.dateStringToObject(endDate);
    
            var days = Math.floor((endDateObj.getTime() - startDateObj.getTime()) / 86400000);
    
            return Math.floor(days / ticks);
        },
    
        _getUserConfiguredDateFormat: function () {
            return this.getContext().getUser().UserProfile.DateFormat;
        },
    
        _getWorkspaceConfiguredDateFormat: function () {
            return this.getContext().getWorkspace().WorkspaceConfiguration.DateFormat;
        },
    
        _buildChartTitle: function (portfolioItem) {
            var widthPerCharacter = 10,
                totalCharacters = Math.floor(this.getWidth() / widthPerCharacter),
                title = "Portfolio Item Chart",
                align = "center";
    
            if (portfolioItem) {
                title = portfolioItem.FormattedID + ": " + portfolioItem.Name;
            }
    
            if (totalCharacters < title.length) {
                title = title.substring(0, totalCharacters) + "...";
                align = "left";
            }
    
            return {
                text: title,
                align: align,
                margin: 30
            };
        },
    
        _buildChartSubtitle: function (portfolioItem) {
            var widthPerCharacter = 6,
                totalCharacters = Math.floor(this.getWidth() / widthPerCharacter),
                plannedStartDate = "",
                plannedEndDate = "";
    
            var template = Ext.create("Ext.XTemplate",
                '<tpl if="plannedStartDate">' +
                    '<span>Planned Start: {plannedStartDate}</span>' +
                    '    <tpl if="plannedEndDate">' +
                    '        <tpl if="tooBig">' +
                    '            <br />' +
                    '        <tpl else>' +
                    '            &nbsp;&nbsp;&nbsp;' +
                    '        </tpl>' +
                    '    </tpl>' +
                    '</tpl>' +
                    '<tpl if="plannedEndDate">' +
                    '    <span>Planned End: {plannedEndDate}</span>' +
                    '</tpl>'
            );
    
            if (portfolioItem && portfolioItem.PlannedStartDate) {
                plannedStartDate = this._formatDate(portfolioItem.PlannedStartDate);
            }
    
            if (portfolioItem && portfolioItem.PlannedEndDate) {
                plannedEndDate = this._formatDate(portfolioItem.PlannedEndDate);
            }
    
            var formattedTitle = template.apply({
                plannedStartDate: plannedStartDate,
                plannedEndDate: plannedEndDate,
                tooBig: totalCharacters < plannedStartDate.length + plannedEndDate.length + 60
            });
    
            return {
                text: formattedTitle,
                useHTML: true,
                align: "center"
            };
        },
    
        _getAggregationType: function () {
            return this.getSetting("chartAggregationType");
        },
    
        _getYAxisTitle: function () {
            return this._getAggregationType() === "storypoints" ?
                "Points" :
                "Count";
        },
    
        _getChartStartDate: function (portfolioItem) {
            var startDateSetting = this._getSettingStartDate().split(","),
                settingValue = startDateSetting[0],
                startDate;
    
            if(startDateSetting[0] === "selecteddate") {
                startDate = this.dateStringToObject(startDateSetting[1]);
            } else {
                startDate = this._dateFromSettingValue(portfolioItem, settingValue);
            }
    
            return this.dateToString(startDate);
        },
    
        _getChartEndDate: function (portfolioItem) {
            var endDateSetting = this._getSettingEndDate().split(","),
                settingValue = endDateSetting[0],
                endDate;
    
            if (endDateSetting[0] === "selecteddate") {
                endDate = this.dateStringToObject(endDateSetting[1]);
            } else {
                endDate = this._dateFromSettingValue(portfolioItem, settingValue);
            }
    
            return this.dateToString(endDate);
        },
    
        _dateFromSettingValue: function (portfolioItem, settingValue) {
            var settingsMap = {
                "plannedstartdate": "PlannedStartDate",
                "plannedenddate": "PlannedEndDate",
                "actualstartdate": "ActualStartDate",
                "actualenddate": "ActualEndDate"
            };
    
            if (settingValue === "today") {
                return new Date();
            }
    
            if (settingsMap.hasOwnProperty(settingValue)) {
                return portfolioItem[settingsMap[settingValue]];
            }
    
            return new Date(settingValue);
        },
    
        _getTimeZone: function () {
            return this.getContext().getUser().UserProfile.TimeZone || this.getContext().getWorkspace().WorkspaceConfiguration.TimeZone;
        },
    
        _portfolioItemNotValid: function () {
            this._setErrorTextMessage('Cannot find the chosen portfolio item.  Please click the gear and "Edit Settings" to choose another.');
        },
    
        _setErrorTextMessage: function (message) {
            this.down('#header').add({
                xtype: 'displayfield',
                value: message
            });
        }
    });

}());
