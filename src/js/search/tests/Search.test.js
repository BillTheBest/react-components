define(function(require) {
    var React = require('react');
    var Search = require('drc/search/Search');
    var SearchActions = require('drc/search/SearchActions');
    var SearchStore = require('drc/search/SearchStore');

    var TestUtils = React.addons.TestUtils;

    describe('Search', function() {
        var search;
        var searchSubmitCallback = function() {};

        beforeEach(function() {
            search = TestUtils.renderIntoDocument(<Search searchSubmitCallback={searchSubmitCallback} url="/test/url" />);
        });

        describe('getInitialState function', function() {
            it('should initialize the state of the component', function() {
                expect(search.getInitialState()).toEqual({
                    placeholder: 'Loading...',
                    disabled: true,
                    itemList: [],
                    shownList: [],
                    inputValue: '',
                    inputFocused: false
                });
            });
        });

        describe('componentDidMount function', function(){
            it('subscribes to store and requests data', function(){
                spyOn(SearchStore, 'on');
                spyOn(SearchActions, 'requestData');

                search.componentDidMount();

                expect(SearchStore.on.calls.count()).toEqual(2);
                expect(SearchActions.requestData).toHaveBeenCalledWith(search.props.url);
            });
        });

        describe('onError function', function(){
            it('calls setState', function(){
                spyOn(search, 'setState');

                search.onError();

                expect(search.setState).toHaveBeenCalledWith({placeholder: 'Unable to load list', disabled: true});
            });
        });

        describe('componentWillUnmount function', function(){
            it('unsubscribes from store', function(){
                spyOn(SearchStore, 'removeListener');

                search.componentWillUnmount();

                expect(SearchStore.removeListener).toHaveBeenCalled();
            });
        });

        describe('onDataReceived function', function(){
            it('calls onError if no data is available', function(){
                spyOn(SearchStore, 'getData').and.returnValue(null);
                spyOn(search, 'onError');
                spyOn(search, 'setState');

                search.onDataReceived();

                expect(SearchStore.getData).toHaveBeenCalledWith();
                expect(search.onError).toHaveBeenCalledWith();
                expect(search.setState.calls.count()).toEqual(0);
            });

            it('calls setstate with data results', function(){
                spyOn(SearchStore, 'getData').and.returnValue('foo');
                spyOn(search, 'onError');
                spyOn(search, 'setState');

                search.onDataReceived();

                expect(SearchStore.getData).toHaveBeenCalledWith();
                expect(search.onError.calls.count()).toEqual(0);
                expect(search.setState.calls.count()).toEqual(1);
                expect(search.setState.calls.allArgs()[0][0]).toBeObject();
                expect(search.setState.calls.allArgs()[0][0].itemList).toEqual('foo');
            });
        });

        describe('getListOfMatchesForQuery function', function(){
            it('returns an empty array if no items are present', function(){
                search.state.itemList = [];
                expect(search.getListOfMatchesForQuery('')).toEqual([]);
            });

            it('returns empty array if no matches were found', function(){
                search.state.itemList = [{
                    name: 'ACME'
                }];

                expect(search.getListOfMatchesForQuery('item A')).toEqual([]);
            });

            it('returns matches if found and sorts results', function(){
                spyOn(search, 'sortMatchingEntries');

                search.state.itemList = [{
                    name: 'ACME'
                }];

                expect(search.getListOfMatchesForQuery('ME')).toEqual([{name: 'ACME', matchIndex: 2}]);
                expect(search.sortMatchingEntries.calls.count()).toEqual(0); //Sort won't get called with a single item

                search.state.itemList = [{
                    name: 'ACME'
                }, {
                    name: 'ME Item'
                }];

                expect(search.getListOfMatchesForQuery('ME')).toEqual([{name: 'ACME', matchIndex: 2}, {name: 'ME Item', matchIndex: 0}]);
                expect(search.sortMatchingEntries).toHaveBeenCalled();
            });

            it('lowercases and replaces spaces in search terms to find matches', function(){
                spyOn(search, 'sortMatchingEntries');
                search.state.itemList = [{
                    name: 'ACME'
                }];

                expect(search.getListOfMatchesForQuery('me')).toEqual([{name: 'ACME', matchIndex: 2}]);
                expect(search.getListOfMatchesForQuery('mE')).toEqual([{name: 'ACME', matchIndex: 2}]);

                search.state.itemList = [{
                    name: 'Item with spaces'
                }];

                expect(search.getListOfMatchesForQuery('with')).toEqual([{name: 'Item with spaces', matchIndex: 4}]);
                expect(search.getListOfMatchesForQuery('item with')).toEqual([{name: 'Item with spaces', matchIndex: 0}]);
                expect(search.getListOfMatchesForQuery('item            with')).toEqual([{name: 'Item with spaces', matchIndex: 0}]);

                search.state.itemList = [];
            });
        });

        describe('sortMatchingEntries function', function(){
            it('sorts based on match Index', function(){
                expect(search.sortMatchingEntries({matchIndex: 1}, {matchIndex: 0})).toEqual(1);
                expect(search.sortMatchingEntries({matchIndex: 100}, {matchIndex: 50})).toEqual(1);

                expect(search.sortMatchingEntries({matchIndex: 0}, {matchIndex: 1})).toEqual(-1);
                expect(search.sortMatchingEntries({matchIndex: 50}, {matchIndex: 100})).toEqual(-1);
            });

            it('sorts based on name if match index is the same', function(){
                expect(search.sortMatchingEntries({matchIndex: 1, name: 'abcd'}, {matchIndex: 1, name: 'abc'})).toEqual(1);
                expect(search.sortMatchingEntries({matchIndex: 1, name: 'longer item'}, {matchIndex: 1, name: 'short item'})).toEqual(1);

                expect(search.sortMatchingEntries({matchIndex: 1, name: 'abc'}, {matchIndex: 1, name: 'abcd'})).toEqual(-1);
                expect(search.sortMatchingEntries({matchIndex: 1, name: 'short item'}, {matchIndex: 1, name: 'longer item'})).toEqual(-1);
            });

            it('sorts alphabetically if all others are the same', function(){
                expect(search.sortMatchingEntries({matchIndex: 1, name: 'cbs'}, {matchIndex: 1, name: 'abc'})).toEqual(1);
                expect(search.sortMatchingEntries({matchIndex: 1, name: 'cnn'}, {matchIndex: 1, name: 'bbc'})).toEqual(1);

                expect(search.sortMatchingEntries({matchIndex: 1, name: 'abc'}, {matchIndex: 1, name: 'bbc'})).toEqual(-1);
                expect(search.sortMatchingEntries({matchIndex: 1, name: 'a'}, {matchIndex: 1, name: 'b'})).toEqual(-1);
            });

            it('returns 0 if items are identical', function(){
                expect(search.sortMatchingEntries({matchIndex: 1, name: 'abc'}, {matchIndex: 1, name: 'abc'})).toEqual(0);
                expect(search.sortMatchingEntries({matchIndex: 1, name: 'a'}, {matchIndex: 1, name: 'a'})).toEqual(0);
            });
        });

        describe('onChange function', function(){
            it('clears list when search term length is 0', function(){
                spyOn(search, 'setState');

                search.onChange({target: {value: ''}});

                expect(search.setState).toHaveBeenCalledWith({inputValue: ''});
                expect(search.setState).toHaveBeenCalledWith({shownList: []});
            });

            it('gets list of matches and sets list', function(){
                spyOn(search, 'setState');
                spyOn(search, 'getListOfMatchesForQuery').and.returnValue(['foo', 'bar']);

                search.onChange({target: {value: 'search term'}});

                expect(search.setState).toHaveBeenCalledWith({inputValue: 'search term'});
                expect(search.getListOfMatchesForQuery).toHaveBeenCalledWith('search term');
                expect(search.setState).toHaveBeenCalledWith({shownList: ['foo', 'bar']});
                expect(search.currentFilteredList).toEqual(['foo', 'bar']);
            });
        });

        describe('onFocus function', function(){
            it('shows list on focus', function(){
                spyOn(search, 'setState');

                search.currentFilteredList = ['foo'];
                search.onFocus();

                expect(search.focusedIndex).toBeNull();
                expect(search.setState).toHaveBeenCalledWith({shownList: ['foo'], inputFocused: true});
            });
        });

        describe('onBlur function', function(){
            it('only calls hidelist if actionOverList', function(){
                spyOn(search, 'hideList');

                search.actionOverList = true;

                search.onBlur();
                expect(search.hideList.calls.count()).toEqual(0);

                search.actionOverList = false;

                search.onBlur();
                expect(search.hideList).toHaveBeenCalledWith();
            });
        });

        describe('onInputKeyPress function', function(){
            it('skips if value entered was something other than escape or key down', function(){
                expect(search.onInputKeyPress({})).toBeUndefined();
                expect(search.onInputKeyPress({keyCode: null})).toBeUndefined();
                expect(search.onInputKeyPress({keyCode: 10})).toBeUndefined();
            });

            it('calls correct handler depending on key code', function(){
                spyOn(search, 'focusNext');
                spyOn(search, 'setState');
                var preventDefaultSpy = jasmine.createSpy();
                var eventObj = {
                    keyCode: 40,
                    preventDefault: preventDefaultSpy
                };

                search.onInputKeyPress(eventObj);
                expect(preventDefaultSpy).toHaveBeenCalledWith();
                expect(search.focusNext).toHaveBeenCalledWith();
                expect(search.setState.calls.count()).toEqual(0);

                eventObj.keyCode = 27;

                search.onInputKeyPress(eventObj);
                expect(preventDefaultSpy).toHaveBeenCalledWith();
                expect(search.currentFilteredList).toEqual([]);
                expect(search.setState).toHaveBeenCalledWith({shownList: [], inputValue: ''});
            });
        });

        describe('onListKeyPress function', function(){
            it('returns when no handler is present', function(){
                expect(search.onListKeyPress({keyCode: 'foo'})).toBeUndefined();
                expect(search.onListKeyPress({keyCode: 2})).toBeUndefined();

                search.listKeyCodeHandlers.foo = 'functionThatDoesntExist';
                expect(search.onListKeyPress({keyCode: "functionThatDoesntExist"})).toBeUndefined();
            });

            it('invokes handler when present', function(){
                spyOn(search, 'focusPrev');

                var preventDefaultSpy = jasmine.createSpy();
                var eventObj = {
                    keyCode: 38,
                    preventDefault: preventDefaultSpy
                };
                search.onListKeyPress(eventObj);
                expect(preventDefaultSpy).toHaveBeenCalledWith();
                expect(search.focusPrev).toHaveBeenCalledWith();
            });
        });

        describe('focusNext function', function(){
            it('calls focus on correct index', function(){
                spyOn(search, 'focusOnItemAtIndex');

                search.focusedIndex = null;

                search.focusNext();
                expect(search.focusOnItemAtIndex).toHaveBeenCalledWith(0);

                search.focusedIndex = 10;

                search.focusNext();
                expect(search.focusOnItemAtIndex).toHaveBeenCalledWith(11);
            });
        });

        describe('focusPrev function', function(){
            it('calls focus on correct index', function(){
                spyOn(search, 'focusOnItemAtIndex');

                search.focusedIndex = null;
                search.focusPrev();
                expect(search.focusOnItemAtIndex.calls.count()).toEqual(0);

                search.focusedIndex = 0;
                search.focusPrev();
                expect(search.focusOnItemAtIndex.calls.count()).toEqual(0);

                search.focusedIndex = 10;
                search.focusPrev();
                expect(search.focusOnItemAtIndex).toHaveBeenCalledWith(9);
            });
        });

        describe('focusOnItemAtIndex function', function(){
            it('sets index and action properties', function(){
                search.focusedIndex = null;
                search.actionOverList = false;

                search.focusOnItemAtIndex(-1);

                expect(search.focusedIndex).toBeNull();
                expect(search.actionOverList).toBeFalse();

                var originalRef = search.refs;
                var focusSpy = jasmine.createSpy();
                search.refs = {list: {
                    getDOMNode: function(){
                        return {childNodes: [1, 2, 3, 4, {focus: focusSpy}]};
                    }
                }};

                search.focusOnItemAtIndex(4);

                expect(search.focusedIndex).toEqual(4);
                expect(search.actionOverList).toBeTrue();
                expect(focusSpy).toHaveBeenCalledWith();

                search.refs = originalRef;
            });
        });

        describe('clearList function', function(){
            it('resets values', function(){
                spyOn(search, 'setState');
                spyOn(search, 'hideList');

                search.clearList(true);
                expect(search.actionOverList).toEqual(false);
                expect(search.currentFilteredList).toEqual([]);
                expect(search.setState).toHaveBeenCalledWith({inputValue: ''});
                expect(search.hideList).toHaveBeenCalledWith();
                search.clearList(false);
            });
        });

        describe('hideList function', function(){
            it('resets values', function(){
                spyOn(search, 'setState');

                search.hideList(true);
                expect(search.focusedIndex).toBeNull();
                expect(search.setState).toHaveBeenCalledWith({shownList: [], inputFocused: false});
            });
        });

        describe('selectItemOnEnter function', function(){
            it('calls itemSelect', function(){
                spyOn(search, 'itemSelect');

                search.selectItemOnEnter();
                expect(search.itemSelect).toHaveBeenCalledWith({target: undefined});
            });
        });

        describe('itemSelect', function(){
            it('bails when no ID found', function(){
                var getAttrSpy = jasmine.createSpy().and.returnValue(null);
                var eventObj = {
                    target: {
                        innerText: 'item Name',
                        getAttribute: getAttrSpy
                    }
                };

                expect(search.itemSelect(eventObj)).toBeUndefined();
            });

            it('clears list and calls the searchSubmitCallback', function(){
                spyOn(search, 'clearList');
                spyOn(search.props, 'searchSubmitCallback');

                var getAttrSpy = jasmine.createSpy().and.returnValue("10");
                var eventObj = {
                    target: {
                        innerText: 'item Name',
                        getAttribute: getAttrSpy
                    }
                };

                search.itemSelect(eventObj);

                expect(search.clearList).toHaveBeenCalledWith(true);
                expect(search.props.searchSubmitCallback).toHaveBeenCalled();
            });
        });

        describe('handleListMouseEnter function', function(){
            it('calls focus on target', function(){
                search.actionOverList = false;
                var focusSpy = jasmine.createSpy();

                search.handleListMouseEnter({target: {focus: focusSpy}});

                expect(search.actionOverList).toBeTrue();
                expect(focusSpy).toHaveBeenCalledWith();
            });
        });

        describe('handleListMouseLeave function', function(){
            it('calls focus on target', function(){
                search.actionOverList = true;

                search.handleListMouseLeave();

                expect(search.actionOverList).toBeFalse();
            });
        });

        describe('getAutocompleteComponents function', function(){
            it('adds markup for each item', function(){
                search.state.shownList = [
                    {
                        id: 10,
                        name: 'acme'
                    },
                    {
                        id: 20,
                        name: 'Apl'
                    }
                ];

                var list = search.getAutocompleteComponents();
                expect(list).toBeArrayOfSize(2);

                var firstItemItem = TestUtils.renderIntoDocument(list[0]),
                    secondItemItem = TestUtils.renderIntoDocument(list[1]);

                expect(TestUtils.isDOMComponent(firstItemItem)).toBeTrue();
                expect(TestUtils.isDOMComponent(secondItemItem)).toBeTrue();

                expect(firstItemItem.props['data-id']).toEqual(10);
                expect(firstItemItem.props.tabIndex).toEqual('-1');
                expect(firstItemItem.props.children).toEqual('acme');

                expect(secondItemItem.props['data-id']).toEqual(20);
                expect(secondItemItem.props.tabIndex).toEqual('-1');
                expect(secondItemItem.props.children).toEqual('Apl');

                search.state.shownList = [];
            });
        });
    });
});