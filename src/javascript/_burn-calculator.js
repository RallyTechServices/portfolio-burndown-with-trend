Ext.define("Rally.apps.charts.rpm.burn.BurnCalculator", {
    extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",

    config: {
        /**
         * @cfg {Boolean} hideBarsAfterToday
         * True to not display the completion bars on the chart if it extends beyond
         * the day that the app is run.  Defaults to false (show all bars flattened
         * to the right of today).
         */
        hideBarsAfterToday: false,
        /**
         * 
         * @type { Ext.data.Model } PI
         * The portfolio item the chart is based on.  (Used for planned end date calcs.)
         * 
         */
        PI: null,
        
        plotLines: []
    },

    getDerivedFieldsOnInput: function () {
        var completedStateNames = this.config.completedScheduleStateNames;

        if (this.config.chartAggregationType === 'storycount') {
            return [
                {
                    "as": "StoryCount",
                    "f": function(snapshot) {
                        return 1;
                    }
                },
                {
                    "as": "CompletedStoryCount",
                    "f": function(snapshot) {
                        var ss = snapshot.ScheduleState;
                        if (completedStateNames.indexOf(ss) > -1) {
                            return 1;
                        }
                        else {
                            return 0;
                        }
                    }
                }
            ];
        }
        else {
            return [
                {
                    "as": "Planned",
                    "f": function(snapshot) {
                        if(snapshot.PlanEstimate) {
                            return snapshot.PlanEstimate;
                        }

                        return 0;
                    }
                },
                {
                    "as": "PlannedCompleted",
                    "f": function(snapshot) {
                        var ss = snapshot.ScheduleState;
                        if(completedStateNames.indexOf(ss) > -1 && snapshot.PlanEstimate) {
                            return snapshot.PlanEstimate;
                        }

                        return 0;
                    }
                }
            ];
        }
    },

    getMetrics: function() {
        if(this.config.chartAggregationType === 'storycount') {
            return [
                {
                    "field": "StoryCount",
                    "as": "Planned",
                    "f": "sum",
                    "display": "line"
                },
                {
                    "field": "CompletedStoryCount",
                    "as": "Completed",
                    "f": "sum",
                    "display": "column"
                }
            ];
        }
        else {
            return [
                {
                    "field": "Planned",
                    "as": "Planned",
                    "display": "line",
                    "f": "sum"
                },
                {
                    "field": "PlannedCompleted",
                    "as": "Completed",
                    "f": "sum",
                    "display": "column"
                }
            ];
        }
    },

    runCalculation: function (snapshots, snapshotsToSubtract) {
        var highcharts_data = this.callParent(arguments);
        
        if ( this.hideBarsAfterToday ) {
            highcharts_data = this._stripFutureBars(highcharts_data);
        }
        
        this._addPlotlines(highcharts_data);
                
        return highcharts_data;
    },
    
    _getDateIndexFromDate: function(highcharts_data, check_date) {
        var date_iso = Rally.util.DateTime.toIsoString(new Date(check_date));
        var date_index = -1;
        console.log('_getDateIndexFromDate', date_iso, highcharts_data.categories.length);
        
        Ext.Array.each(highcharts_data.categories, function(category,idx) {
            if (category > date_iso && date_index == -1 ) {
                date_index = idx - 1;
            }
        });
        
        if ( date_index === 0 ) {
            return date_index = -1;
        }
        return date_index;
    },
    
    _addPlotlines: function(data) {
        
        this.plotLines = [];
        
        var today_index = this._getDateIndexFromDate(data,new Date());
        // PI
        if ( today_index > -1 ) {
            this.plotLines.push({
                color: '#000',
                label: { text: 'today' },
                width: 2,
                value: today_index
            });
        }
        
        
        if ( this.PI && this.PI.PlannedEndDate) {
            
            var end_date_index = this._getDateIndexFromDate(data, this.PI.PlannedEndDate);
            console.log('today index:', today_index);
            console.log('planned end index:', end_date_index);
            
            if ( end_date_index > -1 ) {
                
                this.plotLines.push({
                    color: '#000',
                    label: { text: 'planned end' },
                    width: 2,
                    value: end_date_index
                });
            }
        }
    },
    
    _stripFutureBars: function(data) {
        var today_index = this._getDateIndexFromDate(data,new Date());
        
        if ( today_index > -1 ) {
            Ext.Array.each(data.series, function(series) {
                if ( series.name == "Completed" ) {
                    Ext.Array.each( series.data, function(datum,idx){
                        if ( idx > today_index ) {
                            series.data[idx] = null;
                        }
                    });
                }
            });
        }
        
        return data;
    }
        
});