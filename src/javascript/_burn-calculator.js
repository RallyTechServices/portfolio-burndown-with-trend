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
         * @type { Object } PI
         * The portfolio item the chart is based on.  ( Passed in as an object (record.getData()).
         * Used for planned end date calcs.)
         * 
         */
        PI: null,
        
        PIs: null,
        
        /**
         * 
         * @cfg {Boolean} showTrend
         * Pass true to show a trend line from the PI's actual start through the value 
         * of today and intersecting the scope line.  
         * 
         * For the trend line to show:
         * * This must be true
         * * There must be at least two completed values
         * * There must not be an actual end date
         * * Today must be on the chart
         */
        showTrend: false,
        
        plotLines: [],
        
        nameOfCompletedSeries: 'Accepted'
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
                    "as": this.nameOfCompletedSeries,
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
                    "as": this.nameOfCompletedSeries,
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
        
        if ( this.showTrend ) {
            highcharts_data = this._addTrend(highcharts_data);
        }
        
        this._addPlotlines(highcharts_data);
                
        return highcharts_data;
    },
    
    _getDateIndexFromDate: function(highcharts_data, check_date) {
        var date_iso = Rally.util.DateTime.toIsoString(new Date(check_date),true).replace(/T.*$/,'');
        var date_index = -1;
                
        Ext.Array.each(highcharts_data.categories, function(category,idx) {
            
            if (category >= date_iso && date_index == -1 ) {
                date_index = idx;
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
        if ( today_index > -1 ) {
            this.plotLines.push({
                color: '#000',
                label: { text: 'today' },
                width: 2,
                zIndex: 5, // above series
                value: today_index
            });
        }
        
        var planned_end_date = null;
        
        if ( this.PI && this.PI.PlannedEndDate ) {
            planned_end_date = PI.PlannedEndDate;
        }
        
        if ( this.PIs && this.PIs.length > 0 ) {
            planned_end_date =  this._getLatestDate(this.PIs, 'PlannedEndDate');
        }
        
        if ( planned_end_date ) {
            var end_date_index = this._getDateIndexFromDate(data, Rally.util.DateTime.add( planned_end_date, 'day', -1 ));
            
            if ( end_date_index > -1 ) {
                
                this.plotLines.push({
                    color: '#000',
                    label: { text: 'planned end' },
                    width: 2,
                    zIndex: 5, // above series
                    value: end_date_index
                });
            }
        }

        if ( this.trend_date ) {
            
            var show_line = true;
            if ( planned_end_date && Math.abs(Rally.util.DateTime.getDifference(this.trend_date, planned_end_date, 'day')) < 4 ) {
                show_line = false;
            }
            
            var projected_date_index = this._getDateIndexFromDate(data, this.trend_date);
            console.log('trend date/projected index', this.trend_date, projected_date_index);
            console.log('planned', planned_end_date);
            
            if ( end_date_index > -1 && show_line ) {
                this.plotLines.push({
                    color: '#000',
                    label: { text: 'projected end' },
                    width: 2,
                    zIndex: 5, //above series
                    value: projected_date_index
                });
            }
        }
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
    
    _stripFutureBars: function(data) {
        var today_index = this._getDateIndexFromDate(data,new Date());
        
        if ( today_index > -1 ) {
            Ext.Array.each(data.series, function(series) {
                if ( series.name == this.nameOfCompletedSeries ) {
                    Ext.Array.each( series.data, function(datum,idx){
                        if ( idx > today_index ) {
                            series.data[idx] = null;
                        }
                    });
                }
            },this);
        }
        
        return data;
    },
    
    _getIndexOfFirstNonzeroFromArray:function(data) {
        var index = -1;
        Ext.Array.each(data,function(datum,idx){
            if ( datum > 0 && index == -1 ) {
                index = idx;
            }
        });
        return index;
    },
    
    _addTrend: function(data) {
        if ( Ext.isEmpty(this.PI) && Ext.isEmpty(this.PIs)) {
            return data;
        }

        var completed_series = [];
        var scope_series = [];
        
        Ext.Array.each( data.series, function(s) {
            if ( s.name == this.nameOfCompletedSeries ) {
                completed_series = s;
            }
            if ( s.name == "Planned" ) {
                scope_series = s;
            }
        },this);
        
        var index_of_first_accepted = -1;
        // is there an actual value today?  
        var index_of_today = this._getDateIndexFromDate(data,new Date());
        if ( index_of_today <= 0 ) {
            // need at least two days of data
            console.log("Cannot show trend because the chart needs to start before today");
            return data;
        }
        
        var index_of_first_nonzero = this._getIndexOfFirstNonzeroFromArray(completed_series.data);

        var today_actual = completed_series.data[index_of_today];
        var first_actual = completed_series.data[index_of_first_nonzero];

        if ( today_actual <= first_actual ) {
            console.log("There's no slope to show because current actual is less than or equal to first actual");
            return data;
        }
        
        var slope =  ( today_actual - first_actual ) / ( index_of_today - index_of_first_nonzero ) ;
        
        var scope = scope_series.data[index_of_today];
        
        var calculation_date_limit = Rally.util.DateTime.add(new Date(), 'year', 2);
        this.trend_date = new Date();
        var trend_value = today_actual;
        
        while ( this.trend_date < calculation_date_limit && trend_value <= scope ) {
            this.trend_date = Rally.util.DateTime.add(this.trend_date,'day',1);
            this.trend_date = this._shiftOffWeekend(this.trend_date);
            trend_value = trend_value + slope;
        }
        
        //this.PI.ProjectedEndDate = this.trend_date;
        data = this._setTrendLineSeries(data, index_of_first_nonzero, first_actual, this.trend_date, scope);
        
        return data;
    },
    
    _shiftOffWeekend: function(check_date) {
        if (check_date.getDay() == 6) {check_date = Rally.util.DateTime.add(check_date,'day',1);} // Saturday
        if (check_date.getDay() == 0) {check_date = Rally.util.DateTime.add(check_date,'day',1);} // Sunday
        
        return check_date;
    },
    
    _setTrendLineSeries: function(data, index_of_first_nonzero, first_actual, end_date, end_value) {
        
        var end_date_iso = Rally.util.DateTime.toIsoString(end_date).replace(/T.*$/,'');
        var current_chart_end = data.categories[ data.categories.length - 1];
        
        if ( current_chart_end < end_date_iso ) {
            data = this._padDates(data, current_chart_end, end_date);
        }
        
        var index_of_end = this._getDateIndexFromDate(data,end_date);
        var trend_data = [];
        
        for ( var i=0; i<data.categories.length; i++) {
            if ( i==index_of_end ) { 
                trend_data.push(end_value); 
            } else if ( i==index_of_first_nonzero ) { 
                trend_data.push(first_actual); 
            } else {
                trend_data.push(null);
            }
        }
        data.series.push({
            dashStyle: 'Solid',
            data: trend_data,
            name: 'Trend',
            type: 'line',
            connectNulls: true
        });
        return data;
        
    },
    
    _padDates: function(data,current_end,new_end_date) {
        var count_beyond_current = 0;
        var next_day = Rally.util.DateTime.fromIsoString(current_end);
                
        while ( next_day < new_end_date ) {            
            next_day = Rally.util.DateTime.add(next_day, 'day', 1);
            next_day = this._shiftOffWeekend(next_day);
            var next_day_iso = Rally.util.DateTime.toIsoString(next_day).replace(/T.*$/,'');
            
            if ( next_day_iso != current_end ) {
                data.categories.push(next_day_iso);
                count_beyond_current++;
            }
        }
        
        var completed_series = [];
        var scope_series = [];
        
        Ext.Array.each( data.series, function(s) {
            if ( s.name == this.nameOfCompletedSeries ) {
                completed_series = s;
            }
            if ( s.name == "Planned" ) {
                scope_series = s;
            }
        },this);
        
        var scope = scope_series.data[scope_series.data.length-1];
        for ( var i=0; i<count_beyond_current; i++ ) {
            scope_series.data.push(scope);
            completed_series.data.push(null);
        }
        
        data.series = [scope_series, completed_series];
        return data;
        
    }
        
});