var palette = Ext.create("Rally.apps.charts.Colors");

Ext.define("TSPIBurnupWithTrend", {
    extend: "Rally.apps.charts.rpm.PortfolioChartAppBase",
    cls: "portfolio-burnup-app",
    

    requires: [
        'Rally.ui.chart.Chart',
        'Rally.apps.charts.Colors',
        'Rally.apps.charts.IntegrationHeaders'
    ],

    integrationHeaders : {
        name : "TS Portfolio Item Burnup with Trend"
    },

    getChartComponentConfig: function() {
        var me = this;
        return {
            xtype: "rallychart",
    
            updateBeforeRender: function() {
                var length = this.calculatorConfig.scheduleStates.length,
                    state = this.calculatorConfig.scheduleStates[length - 1];
                if(state !== "Accepted") {
                    this.calculatorConfig.completedScheduleStateNames.push(state);
                }
                
            },
            
            listeners: {
                snapshotsAggregated: function(c) {
                    c.chartConfig.xAxis.plotLines = c.calculator.plotLines;
                    //
                    c.chartConfig.subtitle =  me._buildChartSubtitle(c.calculator.PIs || c.calculator.PI, c.calculator);
                    
                }
            },

            queryErrorMessage: "No data to display.<br /><br />Most likely, stories are either not yet available or started for this portfolio item.",
            aggregationErrorMessage: "No data to display.<br /><br />Check the data type setting for displaying data based on count versus plan estimate.",
    
            storeType: 'Rally.data.lookback.SnapshotStore',
            storeConfig: {
                find: {
                    "_TypeHierarchy": -51038,
                    "Children": null
                },
                fetch: ["ScheduleState", "PlanEstimate"],
                hydrate: ["ScheduleState"],
                sort: {
                    "_ValidFrom": 1
                },
                removeUnauthorizedSnapshots: true
            },

            calculatorType: "Rally.apps.charts.rpm.burn.BurnCalculator",
            calculatorConfig: {
                workDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                timeZone: "GMT",
                completedScheduleStateNames: ["Accepted"],
                hideBarsAfterToday: true,
                showTrend: true
            },

            chartColors: palette.getChartColors(), 

            //chartColors: [], // reset so we can define our own palette
    
            chartConfig: {
                chart: {
                    defaultSeriesType: "area",
                    zoomType: "xy"
                },
                xAxis: {
                    categories: [],
                    tickmarkPlacement: "on",
                    tickInterval: 5,
                    title: {
                        text: "Days",
                        margin: 10
                    }
                },
                yAxis: [
                    {
                        title: {
                            text: "Count"
                        }
                    }
                ],
                tooltip: {
                    formatter: function () {
                        return "" + this.x + "<br />" + this.series.name + ": " + this.y;
                    }
                },
                plotOptions: {
                    series: {
                        marker: {
                            enabled: false,
                            states: {
                                hover: {
                                    enabled: true
                                }
                            }
                        },
                        groupPadding: 0.01
                    },
                    line: {
                        //color: palette.burnLineColor()
                    },
                    column: {
                        stacking: null,
                        //color: palette.burnColumnColor(),
                        shadow: false
                    }
                }
            }
        }
    },
    
    _getRallyDateFormat: function () {
        var dateFormat = this._getUserConfiguredDateFormat() || this._getWorkspaceConfiguredDateFormat();

        for (var i = 0; i < this.dateFormatters.length; i++) {
            dateFormat = dateFormat.replace(this.dateFormatters[i].key, this.dateFormatters[i].value);
        }

        return dateFormat;
    },

    _formatDate: function (date) {
        
        if (!this.dateFormat) {
            this.dateFormat = this._getRallyDateFormat();
        }

        return Ext.Date.format(date, this.dateFormat);
    },
        
    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        // Ext.apply(this, settings);
        if ( this.down('rallychart') ) { this.down('rallychart').destroy(); }
        this.launch();
    }
});

