var React = require('react');
var d3Select = require('d3-selection');
var d3Shape = require('d3-shape');
var d3Interpolate = require('d3-interpolate');
var _ = require('lodash');
//This automatically adds a `transition` method to existing d3 selector methods, so no need to assign it's return
require('d3-transition');

var DataMixins = require('../mixins/DataMixins');
var PieChartActions = require('./PieChartActions');
var PieChartStore = require('./PieChartStore');
var Utils = require('../utils/Utils');

var defaultColors = [
    '#00B0F1', //dark blue
    '#6DD2F7', //light blue
    '#58C99E', //light green
    '#11B275', //dark green
    '#53959C', //slate
    '#545F88', //lavender
    '#6E4A99', //grape
    '#D35E5E', //pink
    '#E4C000', //yellow
    '#F37E1C', //orange
    '#ECECEC', //off-white
    '#BC0C0C'  //red
];

/**
 * PieChart React Class
 */
var PieChart = React.createClass({
    propTypes: {
        componentId: React.PropTypes.string.isRequired,
        colors: React.PropTypes.array,
        definition: React.PropTypes.object.isRequired,
        filters: React.PropTypes.object,
        loadingIconClasses: React.PropTypes.oneOfType([
            React.PropTypes.string,
            React.PropTypes.array
        ])
    },

    mixins: [
        DataMixins.dataRequest,
        DataMixins.destroySelfOnUnmount(PieChartActions),
        DataMixins.eventSubscription(PieChartStore)
    ],

    /**
     * Stores DOM node holding chart
     * @type {Object}
     */
    chart: null,

    /**
     * Function to generate chart segments
     * @type {Function}
     */
    arc: null,

    /**
     * Pixels to add to segment radius. Used for mouseover events.
     * @type {Number}
     */
    extraRadius: 0,

    /**
     * Returns initial data for Pie Chart. Calculates loading property
     * if we haven't yet received data
     * @return {Object} Initial state of chart
     */
    getInitialState() {
        this.colors = this.props.colors && _.isArray(this.props.colors) ? this.props.colors : defaultColors;
        return {
            loading: true,
            svgID: `pieChart${this.props.componentId}`,
            dataStack: [],
            selectedRowName: null,
            width: 1,
            height: 1,
            radius: 1,
            dataError: false
        };
    },

    /**
     * Creates contents of SVG compoenent to render pie chart. Also adds
     * events for mouseover/mouseout/click to handle animations and drill ins
     * @param {Object} data Data to display in pie chart
     */
    createVisualization(data){
        var colorCounter = 0,
            //For animation delays, only do a delay if we have a handful of elements. We don't want the chart to take 10 seconds to render
            delay = (data.length > 5) ? (data.length > 8) ? 25 : 50 : 75;

        //Clear out any existing svg path nodes
        d3Select.select(`#${this.state.svgID}-container`).selectAll("*").remove();

        var pie = d3Shape.pie()
            .padAngle(0.03)
            .value((dataNode) => {return dataNode.value; })
            //Data comes pre-sorted from the server so don't let d3 to any additional sorting
            .sort(null);

        var g = this.chart.selectAll("path")
            .data(pie(data))
            .enter();

        var group = g.append('path');

        group
            .style("fill", () => { return this.colors[colorCounter++]; })
            .style("cursor", (dataNode) => {
                if (_.isArray(dataNode.data.children) && dataNode.data.children.length) {
                    return "pointer";
                }
            })
            .transition()
            .delay((dataNode, index) => { return index * delay; })
            .duration(150)
            .attrTween('d', (dataNode) => {
                var interpolate = d3Interpolate.interpolate(dataNode.startAngle + 0.1, dataNode.endAngle);
                return (time) => {
                    dataNode.endAngle = interpolate(time);
                    return this.arc(dataNode);
                };
            })
            //Add mouse events only after animation is complete.
            .each(() => {
                setTimeout(() => {
                    group.on("click", this.drillIn);
                    group.on("mouseover", this.mouseover);
                    group.on("mouseleave", this.mouseout);
                }, 400);
            });
    },

    /**
     * Handles clicking on a segment to drill in. If segment
     * has no sub data, nothing will happen
     * @param {Object} node Data of segment clicked
     */
    drillIn(node){
        if(!node.data.children){
            return;
        }
        var dataStack = this.state.dataStack;
        dataStack.push({
            data: node.data.children,
            label: `${node.data.name} - ${node.data.percent}%`
        });
        this.createVisualization(node.data.children);
        this.setState({dataStack: dataStack});
        document.getElementById(`item-list-${this.props.componentId}`).scrollTop = 0;
    },

    /**
     * Handles clicking on parent label to go back to parent data
     */
    drillOut(){
        var dataStack = this.state.dataStack;
        dataStack.pop();
        this.createVisualization(_.last(dataStack).data);
        this.setState({dataStack});
        document.getElementById(`item-list-${this.props.componentId}`).scrollTop = 0;
    },

    /**
     * Handles mouseover event. Causes the segment that was hovered on to increase it's radius
     * size a bit.
     * @param {Object} dataNode Data of node that was hovered
     */
    mouseover(dataNode){
        this.setState({selectedRowName: dataNode.data.name});

        // Shrink all the segments back to normal radius.
        this.chart.selectAll("path").attr('d', this.arc);

        //Expand radius of selected node
        this.extraRadius = 10;
        this.chart.selectAll(`#${this.state.svgID} path`)
            .filter((node) => {
                return node.data.name === dataNode.data.name;
            })
            .transition()
            .duration(100)
            .attr('d', this.arc);
        this.extraRadius = 0;
    },

    /**
     * Handles leaving a segment. Shinks radius back to normal size
     */
    mouseout(){
        var mouseover = this.mouseover;
        this.setState({selectedRowName: null});
        this.chart.selectAll("path").on("mouseover", null);

        // Transition each segment back to normal radius then re-add mouseover
        this.chart.selectAll("path")
            .transition()
            .duration(100)
            .attr("d", this.arc)
            .each(function(){
                d3Select.select(this).on("mouseover", mouseover);
            });
    },

    /**
     * Handle store change event. Calculate the width of the area we're rendering in and
     * build up the chart with the data
     */
    onDataReceived() {
        var data = PieChartStore.getData(this.props.componentId);

        if(!data){
            this.onError();
            return;
        }

        //Calculate height and width from the width of the container
        var chartContainer = d3Select.select(`#${this.state.svgID}`),
            width = Math.min(325, parseInt(chartContainer.style("width"))) - 25,
            height = width * 0.75,
            radius = (Math.min(width, height) / 2) - 20;

        var dataStack = this.state.dataStack;
        dataStack.push({
            data: data,
            label: null
        });

        this.setState({
            width: width,
            height: height,
            radius: radius,
            dataStack: dataStack,
            loading: false
        });

        this.chart = d3Select.select(`#${this.state.svgID}-container`);

        this.arc = d3Shape.arc()
            .outerRadius(() => {
                return radius + this.extraRadius;
            })
            .innerRadius(radius - 50);

        this.createVisualization(data);
    },

    /**
     * Handle request error.
     */
    onError(){
        this.setState({loading: false, dataError: true});
    },

    /**
     * Send a request for data
     */
    requestData() {
        this.setState({loading: true, dataError: false});
        PieChartActions.requestData(this.props.componentId, this.props.definition, this.props.filters);
    },

    /**
     * After the render cycle runs, check if a row is currently selected and, if necessary,
     * scroll to the item in the list. This makes it so the pie chart segment being hovered
     * is always visible in the table.
     */
    componentDidUpdate(){
        var selectedRow = document.querySelector('tr.selected');
        if(selectedRow && selectedRow.rowIndex !== undefined){
            var rowIndex = selectedRow.rowIndex,
                scrollHeight = 0;
            //We only scroll items past the first 4 since we can always see 4 items in the list
            if(rowIndex > 3){
                //Rows are either 46 or 48 px wide (odd vs even rows) so split the distance. We also
                //only scroll every 4th item
                scrollHeight = 47 * (rowIndex - (rowIndex % 4));
            }
            document.getElementById(`item-list-${this.props.componentId}`).scrollTop = scrollHeight;
        }
    },

    /**
     * Generates markup for table to display data list
     * @returns {Array|Boolean} - The rows for the data list
     */
    getRowDisplay(){
        var dataList = _.last(this.state.dataStack);

        if(!dataList){
            return false;
        }
        dataList = dataList.data;

        return _.map(dataList, (data, index) => {
            var color = {backgroundColor: this.colors[index]},
                isSelected = this.state.selectedRowName === data.name,
                rowBackground = isSelected ? {borderLeft: `solid 6px ${this.colors[index]}`} : {},
                rowClasses = Utils.classSet({
                    'table-even': index % 2,
                    'table-odd': index % 2 === 0,
                    selected: isSelected
                }),
                value = <span className="table-val" title={`Count: ${data.value}`}>{`${data.percent}%`}</span>;

            if (typeof this.props.definition.valueFormat === 'function') {
                value = this.props.definition.valueFormat(data);
            }

            return (
                <tr key={`table-row-${index}`} className={rowClasses}><td>
                    <div className="row-container" style={rowBackground}>
                        <span className="color-legend" style={color} />
                        <span className="table-key">{data.name}</span>
                        {value}
                    </div>
                </td></tr>
            );
        }, this);
    },

    render() {
        var currentData = _.last(this.state.dataStack),
            breadCrumb, noResults;
        if(currentData && currentData.label){
            breadCrumb = <span className="breadCrumb" onClick={this.drillOut}><i className="ion ion-chevron-left" />{currentData.label}</span>;
        }

        var containerClasses = Utils.classSet('data-container', {
            masked: this.state.loading || this.state.dataError,
            error: this.state.dataError
        });

        if (currentData && !currentData.data.length) {
            noResults = <div className="no-results">There were no results that matched the selected range.</div>;
        }

        return (
            <div className="data-component pie-chart">
                <span className="module-sub-heading">{PieChartStore.getLabel(this.props.componentId)}</span>
                <div className={containerClasses}>
                    <i className={Utils.getLoaderClasses(this.state.loading, this.props.loadingIconClasses)} />
                    <div className="pie-chart-data">
                        {breadCrumb}
                        {noResults}
                        <div id={this.state.svgID} ref="chartNode" className="pie-chart-wrapper">
                            <svg height={this.state.height} width={this.state.width}>
                                <g id={`${this.state.svgID}-container`} transform={`translate(${this.state.width / 2},${this.state.height / 2})`} />
                            </svg>
                        </div>
                    </div>
                    <div className="table-container" id={`item-list-${this.props.componentId}`}>
                        <table className="table-body">
                            <tbody>
                                {this.getRowDisplay()}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        );
    }
});

module.exports = PieChart;
