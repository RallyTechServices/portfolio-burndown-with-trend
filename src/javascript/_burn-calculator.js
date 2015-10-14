Ext.define("Rally.apps.charts.rpm.burn.BurnCalculator", {
    extend: "Rally.data.lookback.calculator.TimeSeriesCalculator",

    config: {
        /**
         * @cfg {Boolean} hideBarsAfterToday
         * True to not display the completion bars on the chart if it extends beyond
         * the day that the app is run.  Defaults to false (show all bars flattened
         * to the right of today).
         */
        hideBarsAfterToday: false
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
        return highcharts_data;
    },
    
    _stripFutureBars: function(data) {
        console.log('data', data);
        var today_iso = Rally.util.DateTime.toIsoString(new Date());
        var today_index = -1;
        Ext.Array.each(data.categories, function(category,idx) {
            if (category > today_iso && today_index == -1 ) {
                today_index = idx;
            }
        });
        
        if ( today_index > -1 ) {
            Ext.Array.each(data.series, function(series) {
                if ( series.name == "Completed" ) {
                    Ext.Array.each( series.data, function(datum,idx){
                        if ( idx >= today_index ) {
                            series.data[idx] = null;
                        }
                    });
                }
            });
        }
        
        return data;
    }
        
});