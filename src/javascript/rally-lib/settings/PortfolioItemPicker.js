(function () {
    var Ext = window.Ext4 || window.Ext;

    Ext.define("Rally.apps.charts.settings.PortfolioItemPicker", {
        extend: "Ext.form.FieldContainer",
        alias: "widget.chartportfolioitempicker",

        settingsParent: undefined,
        requestContext: undefined,

        requires: [
            'Deft.Deferred',
            'Rally.util.Test',
            'Rally.ui.EmptyTextFactory',
            'Rally.ui.dialog.ChooserDialog',
            'Rally.data.wsapi.Store'
        ],

        mixins: [
            'Ext.form.field.Field',
            'Rally.apps.charts.settings.SettingsChangeMixin'
        ],

        emptyText: '<p>No portfolio items match your search criteria.</p>',

        items: [
            {
                xtype: "label",
                text: "Portfolio Item",
                cls: "settingsLabel"
            },
            {
                xtype: "container",
                name: "portfolioItemPicker",
                layout: {
                    type: "hbox"
                },
                items: [
                    {

                        xtype: 'rallybutton',
                        text: 'Choose',
                        itemId: 'portfolioItemButton',
                        cls: 'piButton primary small'
                    },
                    {
                        xtype: 'container',
                        cls: 'piDisplayField',
                        items: [
                            {
                                xtype: 'displayfield',
                                itemId: 'portfolioItemDisplay',
                                value: "&nbsp;"
                            }
                        ]
                    }

                ]
            }
        ],

        initComponent: function () {
            this.callParent(arguments);
            this._addTestClass();
        },

        _addTestClass: function () {
            this.addCls(Rally.util.Test.toBrowserTestCssClass('buttonChooser'));
        },

        beforeRender: function () {
            this._configureButton();
            this._configurePicker();
        },

        _configureButton: function () {
            this.down('#portfolioItemButton').on('click', this._onButtonClick, this);
        },

        _configurePicker: function () {
            this._setValueFromSettings();
            this._setupRequestContext();
            this._loadPortfolioItem();
        },

        _setupRequestContext: function () {
            this.requestContext = {
                workspace: this.settingsParent.app.context.getWorkspaceRef(),
                project: null
            };
        },

        _setValueFromSettings: function () {
            var newSettingsValue = this.settingsParent.app.getSetting("portfolioItemPicker"),
                oldSettingsValue = this.settingsParent.app.getSetting("buttonchooser");

            if (this._isSettingValid(newSettingsValue)) {
                this.setValue(newSettingsValue);
            } else if (this._isSettingValid(oldSettingsValue)) {
                this.setValue(Ext.JSON.decode(oldSettingsValue).artifact._ref);
            } else {
                this.setValue("&nbsp;");
            }
        },

        _isSettingValid: function (value) {
            return value && value !== "undefined";
        },

        _loadPortfolioItem: function () {
            if (this._isSavedValueValid()) {
                this._createPortfolioItemStore();
            }
        },

        _createPortfolioItemStore: function () {
            Ext.create("Rally.data.wsapi.Store", {
                model: Ext.identityFn("Portfolio Item"),
                filters: [
                    {
                        property: "ObjectID",
                        operator: "=",
                        value: Rally.util.Ref.getOidFromRef(this.value)
                    }
                ],
                context: this.requestContext,
                autoLoad: true,
                listeners: {
                    load: this._onPortfolioItemRetrieved,
                    scope: this
                }
            });
        },

        _isSavedValueValid: function () {
            return typeof this.value === "string" && this.value !== "undefined";
        },

        _onPortfolioItemRetrieved: function (store) {
            var storeData = store.getAt(0);
            this._handleStoreResults(storeData);
        },

        _setDisplayValue: function () {
            this.down("#portfolioItemDisplay").setValue(this._getPortfolioItemDisplay());
        },

        _onButtonClick: function () {
            this._destroyChooser();

            this.dialog = Ext.create("Rally.ui.dialog.ArtifactChooserDialog", this._getChooserConfig());
            this.dialog.show();
        },

        _destroyChooser: function () {
            if (this.dialog) {
                this.dialog.destroy();
            }
        },

        _getPortfolioItemDisplay: function () {
            if ( this.portfolioItems && Ext.isArray(this.portfolioItems) ) {
                if ( this.portfolioItems.length == 1 ) {
                    return this.portfolioItems[0].FormattedID + ': ' + this.portfolioItems[0].Name;
                }
                return Ext.Array.map(this.portfolioItems, function(pi) { return pi.FormattedID; }).join(',');
            }
            return this.portfolioItem.FormattedID + ': ' + this.portfolioItem.Name;
        },

        _onPortfolioItemChosen: function (dialog,resultStore) {
            this._handleStoreResults(resultStore);
            this._destroyChooser();
        },

        _handleStoreResults: function(store) {
            console.log('_handleStoreResults', store);
            
            if (store) {
                if ( Ext.isArray(store) ) {

                    this.portfolioItems = Ext.Array.map(store, function(pi) { return pi.getData(); });
                    this.portfolioItemRefs = Ext.Array.map(store, function(pi) { return pi.get('_ref'); });
                    
                    this._setDisplayValue();
                    this.setValue(this.portfolioItemRefs);
                    this.sendSettingsChange(this.portfolioItems);
                } else if (store.data) {
                    this.portfolioItem = store.data;
                    this._setDisplayValue();
                    this.setValue(this.portfolioItem._ref);
                    this.sendSettingsChange(this.portfolioItem);
                }
            }
        },

        _getChooserConfig: function () {
            console.log('open chooser', this.value);
            return {
                artifactTypes: ['portfolioitem'],
                multiple: true,
                height: 350,
                title: 'Choose a Portfolio Item',
                closeAction: 'destroy',
                selectionButtonText: 'Select',
                selectedRecords: this.value,
                listeners: {
                    artifactChosen: this._onPortfolioItemChosen,
                    scope: this
                },
                storeConfig: {
                    project: null,
                    context: this.requestContext,
                    fetch: ['ObjectID','Project','WorkSpace','FormattedID','Name','ActualStartDate','PlannedStartDate','ActualEndDate','PlannedEndDate']
                },
                gridConfig: {
                    viewConfig: {
                        emptyText: Rally.ui.EmptyTextFactory.getEmptyTextFor(this.emptyText)
                    }
                }
            };
        },

        setValue: function (value) {
            console.log('set value', value);
            
            if (value && value !== "undefined") {
                if ( Ext.isString(value) ) {
                    value = value.split(',');
                }
                this.value = value;
            }
            else {
                this.value = this.settingsParent.app.getSetting("portfolioItemPicker");
            }
        },

        getSubmitData: function () {
            console.log("getSubmitData");
            var returnObject = {};

            if ( this.portfolioItemRefs && Ext.isArray(this.portfolioItemRefs) ) {
                this.setValue(this.portfolioItemRefs);
                returnObject.portfolioItemPicker = this.portfolioItemRefs;                
            } else if (this.portfolioItem) {

                this.setValue(this.portfolioItem._ref);
                returnObject.portfolioItemPicker = this.portfolioItem._ref;
            }
            else {
                returnObject.portfolioItemPicker = "";
            }

            console.log('returning', returnObject);
            return returnObject;
        }
    });
}());