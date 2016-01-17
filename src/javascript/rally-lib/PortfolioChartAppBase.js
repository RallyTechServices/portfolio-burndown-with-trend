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
            return this.chartSettings && this.chartSettings.getSettingsConfiguration();
        },
    
        clientMetrics: {
            beginEvent: 'updateBeforeRender',
            endEvent: 'updateAfterRender',
            description: 'pichartapp - elapsed chart load'
        },
    
        launch: function () {
            this.logger.log('launch');
            
            this._setupEvents();
    
            this._setupChartSettings();
    
            this._setDefaultConfigValues();
            this._setupUpdateBeforeRender();
    
            this._loadSavedPortfolioItems();
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
            var config = Ext.clone(this.getChartComponentConfig());
    
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
    
    
        _loadSavedPortfolioItems: function () {
            if (!this._validateSettingsChoices()) {
                // force pop up the settings
                
                if ( this.isExternal() ) {
                    return;
                }
                return this.showSettings();
            }
    
            var portfolioItemRefs = this.getSetting(this.PI_SETTING);
            
            if ( Ext.isString(portfolioItemRefs) ) { 
                portfolioItemRefs = portfolioItemRefs.split(',');
            }
            
            var filter_array = [{ property: 'ObjectID', value: -1 }];
            Ext.Array.each(portfolioItemRefs, function(ref) {
                filter_array.push({property:'ObjectID', value: Rally.util.Ref.getOidFromRef(ref)});
            });
            
            
            var store = Ext.create("Rally.data.wsapi.Store", {
                model: Ext.identityFn("Portfolio Item"),
                filters: Rally.data.wsapi.Filter.or(filter_array),
                context: {
                    workspace: this.getContext().getWorkspaceRef(),
                    project: null
                },
                scope: this
            });
    
            store.on('load', this._onPortfolioItemsRetrieved, this);
            store.load();
        },

        _getEarliestDate: function(artifacts, field_name){            
            var chosen_date = null;
            Ext.Array.each(artifacts, function(artifact) {
                var artifact_date = artifact[field_name] || artifact.get(field_name);
                if ( artifact_date ) {
                    if ( !chosen_date || artifact_date < chosen_date ) {
                        chosen_date = artifact_date;
                    }
                }
            });
            
            return chosen_date;
        },

        _getLatestDate: function(artifacts, field_name){
            var chosen_date = null;
            Ext.Array.each(artifacts, function(artifact) {
                var artifact_date = artifact[field_name] || artifact.get(field_name);
                if ( artifact_date ) {
                    if ( !chosen_date || artifact_date > chosen_date ) {
                        chosen_date = artifact_date;
                    }
                }
            });
            
            return chosen_date;
        },
        
        _validateSettingsChoices: function () {
            this.logger.log('_validateSettingsChoices', this.getSettings());
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
    
        _onPortfolioItemsRetrieved: function (store, piRecords) {
            this.logger.log('_onPortfolioItemsRetrieved', store, piRecords);
    
//            if (!this._savedPortfolioItemValid(portfolioItemRecord)) {
//                this._portfolioItemNotValid();
//                return;
//            }
    
            if (piRecords.length > 0) {
                Rally.data.ModelFactory.getModel({
                    type: 'UserStory',
                    success: function (model) {
                        this._onUserStoryModelRetrieved(model, piRecords);
                    },
                    scope: this
                });
            } else {
                this._setErrorTextMessage("A server error occurred, please refresh the page.");
            }
        },
    
        _onUserStoryModelRetrieved: function (model, portfolioItems) {
            var scheduleStateValues = model.getField('ScheduleState').getAllowedStringValues();
            this.chartComponentConfig.calculatorConfig.scheduleStates = scheduleStateValues;
    
            this._setDynamicConfigValues(portfolioItems);
            this._calculateDateRange(portfolioItems);

            this._updateQueryConfig(portfolioItems);
    
            this.add(this.chartComponentConfig);
        },
    
        _setDynamicConfigValues: function (portfolioItems) {
            this._updateChartConfigDateFormat();
            this.chartComponentConfig.chartConfig.title =    this._buildChartTitle(portfolioItems);
            this.chartComponentConfig.chartConfig.subtitle = this._buildChartSubtitle(portfolioItems);
    
            this.chartComponentConfig.calculatorConfig.showTrend = this._getShowTrend(portfolioItems);
            
            this.chartComponentConfig.calculatorConfig.chartAggregationType = this._getAggregationType();
            this.chartComponentConfig.chartConfig.yAxis[0].title.text = this._getYAxisTitle();
    
            this.chartComponentConfig.chartConfig.yAxis[0].labels = {
                x: -5,
                y: 4
            };
        },
        
        _getShowTrend: function(portfolioItems) {            
            var actual_start = this._getEarliestDate(portfolioItems, 'ActualStartDate');            
            return !Ext.isEmpty(actual_start);
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
    
        _calculateDateRange: function (portfolioItems) {
            var calcConfig = this.chartComponentConfig.calculatorConfig;
            calcConfig.startDate = calcConfig.startDate || this._getChartStartDate(portfolioItems);
            calcConfig.endDate = calcConfig.endDate || this._getChartEndDate(portfolioItems);
            calcConfig.timeZone = calcConfig.timeZone || this._getTimeZone();
            calcConfig.PIs = portfolioItems;
            this.chartComponentConfig.chartConfig.xAxis.tickInterval = this._configureChartTicks(calcConfig.startDate, calcConfig.endDate);
        },
    
        _updateQueryConfig: function (portfolioItems) {
            var oids = Ext.Array.map(portfolioItems, function(pi) { return pi.get('ObjectID'); });
            
            this.chartComponentConfig.storeConfig.find._ItemHierarchy = { '$in': oids };
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
    
        _buildChartTitle: function (portfolioItems) {            
            var widthPerCharacter = 10,
                totalCharacters = Math.floor(this.getWidth() / widthPerCharacter),
                title = "Portfolio Item Chart",
                align = "center";
    
            if (portfolioItems) {
                if ( portfolioItems.length == 1 ) {
                    title = portfolioItems[0].get('FormattedID') + ": " + portfolioItems[0].get('Name');
                } else if ( portfolioItems.length > 1 ) {
                    title = Ext.Array.map(portfolioItems, function(pi) { return pi.get('FormattedID'); }).join(',');
                }
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
    
        _buildChartSubtitle: function (portfolioItems,calculator) {            
            var widthPerCharacter = 6,
                totalCharacters  = Math.floor(this.getWidth() / widthPerCharacter),
                plannedStartDate = "",
                plannedEndDate   = "",
                projectedEndDate = "";
                
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
                    '</tpl>' + 
                    '    <tpl if="projectedEndDate">' +
                    '        <tpl if="tooBig">' +
                    '            <br />' +
                    '        <tpl else>' +
                    '            &nbsp;&nbsp;&nbsp;' +
                    '        </tpl>' +
                    '    </tpl>' +
                    '<tpl if="projectedEndDate">' +
                    '    <span>Projected End: {projectedEndDate}</span>' +
                    '</tpl>'
            );
    
            var actual_start = this._getEarliestDate(portfolioItems, 'ActualStartDate');
            var actual_end = this._getLatestDate(portfolioItems, 'ActualEndDate');
            var planned_start = this._getEarliestDate(portfolioItems, 'PlannedStartDate');
            var planned_end =  this._getLatestDate(portfolioItems, 'PlannedEndDate');
                
            if (planned_start) {
                plannedStartDate = this._formatDate(planned_start);
            }
    
            if (planned_end) {
                plannedEndDate = this._formatDate(planned_end);
            }
            
            if ( calculator && calculator.trend_date ) {
//            if (portfolioItem && portfolioItem.ProjectedEndDate) {
                projectedEndDate = this._formatDate(calculator.trend_date);
            }
            
            var title_data = {
                plannedStartDate: plannedStartDate,
                plannedEndDate: plannedEndDate,
                projectedEndDate: projectedEndDate,
                tooBig: totalCharacters < plannedStartDate.length + plannedEndDate.length + projectedEndDate.length + 60
            };
    
            var formattedTitle = template.apply(title_data);
                
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
    
        _getChartStartDate: function (portfolioItems) {
            var startDateSetting = this._getSettingStartDate().split(","),
                settingValue = startDateSetting[0],
                startDate;
    
            if(startDateSetting[0] === "selecteddate") {
                startDate = this.dateStringToObject(startDateSetting[1]);
            } else {                
                startDate = this._dateFromSettingValue(portfolioItems, settingValue);
            }
    
            return this.dateToString(startDate);
        },
    
        _getChartEndDate: function (portfolioItems) {
            var endDateSetting = this._getSettingEndDate().split(","),
                settingValue = endDateSetting[0],
                endDate;
    
            if (endDateSetting[0] === "selecteddate") {
                endDate = this.dateStringToObject(endDateSetting[1]);
            } else {
                endDate = this._dateFromSettingValue(portfolioItems, settingValue);
            }
    
            return this.dateToString(endDate);
        },
    
        _dateFromSettingValue: function (portfolioItems, settingValue) {
            if (settingValue === "today") {
                return new Date();
            }
            
            var settingsMap = {
                "plannedstartdate": this._getEarliestDate(portfolioItems, 'PlannedStartDate'),
                "plannedenddate": this._getLatestDate(portfolioItems, 'PlannedEndDate'),
                "actualstartdate": this._getEarliestDate(portfolioItems, 'ActualStartDate'),
                "actualenddate": this._getLatestDate(portfolioItems, 'ActualEndDate')
            };

            if (settingsMap.hasOwnProperty(settingValue)) {
                return settingsMap[settingValue];
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
