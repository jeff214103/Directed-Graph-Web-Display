/**
 * @author Lam Chun Ting Jeff
 * @version 0.0.1
 * 
 */

var DirectGraph = (function () {
    /**
     * computeTextSize, given a text and font size, it will compute the width and height
     * @param {string} text
     * @param {number} fontSize
     * @returns {{width: number, height: string}}
     */

    function computeTextSize(text, fontSize) {
        if (!d3) return;
        var container = d3.select('body').append('svg');
        container.append('text').text(text).style('font-size', fontSize).attr({ x: -99999, y: -99999 });
        var size = container.node().getBBox();
        container.remove();
        return { width: size.width, height: size.height };
    }

    /**
     * binarySearchTextFont, given a text, maxFontSize, boundarySize of object, key (either width or height), 
     * it will search for the best fit font size for particular text bounding with the boundarySize
     * @param {string} text
     * @param {number} maxFontSize
     * @param {number} boundarySize
     * @param {string} key Either 'width' or 'height' as parameter
     * @returns {number}
     */

    function binarySearchTextFont(text, maxFontSize, boundarySize, key) {
        if (text == '') {
            return 0;
        }
        if (!(key == 'width' || key == 'height')) {
            return 3;
        }
        var left = 3;
        var right = Math.floor(maxFontSize);
        while (left <= right) {
            var mid = Math.floor((left + right) / 2);
            if (computeTextSize(text, mid)[key] < boundarySize) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        return right;
    }

    /**
     * Enum type for boxFit, it used for applyBoxFit Function
     */

    const BoxFit = {
        fill: 'fill',
        contain: 'contain',
        cover: 'cover',
    }

    /**
     * applyBoxFit, given the fit method for input_size and output_size, it will return the resized box
     * @param {BoxFit} fit
     * @param {{width: number, height: string}} input_size
     * @param {{width: number, height: string}} output_size
     * @returns {{width: number, height: string}}    
     */
    function applyBoxFit(fit, input_size, output_size) {

        // Check for the parameter given valid, if not, return as original data
        if (input_size.height === undefined || input_size.height <= 0.0 || input_size.width === undefined || input_size.width <= 0.0 || output_size.height === undefined || output_size.height <= 0.0 || output_size.width === undefined || output_size.width <= 0.0) {
            return {
                source: {
                    height: 0,
                    width: 0
                },
                destination: {
                    height: 0,
                    width: 0
                },
            }
        }

        var source_size, dest_size;
        switch (fit) {
            case BoxFit.fill:
                source_size = input_size;
                dest_size = output_size;
                break;
            case BoxFit.contain:
                source_size = input_size;
                if (output_size.width / output_size.height > source_size.width / source_size.height) {
                    dest_size = {
                        width: source_size.width * output_size.height / source_size.height,
                        height: output_size.height
                    };
                } else {
                    dest_size = {
                        width: output_size.width,
                        height: source_size.height * output_size.width / source_size.width
                    };
                }
                break;
        }
        return {
            source: source_size,
            destination: dest_size,
        }
    }

    /**
    * findInterceptForDestNode, given two points (x,y) and size of node1, node2, find the intersaction point between the line of node1 and ndoe2, to node2 as a circle with radius size.
    * @param {{x: number, y: number, size: number}} node1
    * @param {{x: number, y: number, size: number}} node2
    * @param {number} sizeOffset Depends on the shape, there is different offset, .i.e. circle as 1
    * @returns {{width: number, height: string}}    
    */

    function findInterceptForDestNode(node1, node2, sizeOffset) {

        //Internal function, finding the circle line intersection
        function getCircleLineIntersection(node, slope, yIntercept) {
            const a = slope * slope + 1;
            const b = 2 * (slope * yIntercept - slope * node.y - node.x);
            const c = node.x * node.x + node.y * node.y + yIntercept * yIntercept -
                2 * yIntercept * node.y - node.size * node.size;
            const discriminant = b * b - 4 * a * c;
            if (discriminant < 0) {
                return [];
            } else if (discriminant === 0) {
                const x = -b / (2 * a);
                const y = slope * x + yIntercept;
                return [{ x, y }];
            } else {
                const x1 = (-b + Math.sqrt(discriminant)) / (2 * a);
                const y1 = slope * x1 + yIntercept;
                const x2 = (-b - Math.sqrt(discriminant)) / (2 * a);
                const y2 = slope * x2 + yIntercept;
                return [{ x: x1, y: y1 }, { x: x2, y: y2 }];
            }
        }


        // Check if val is in between v1,v2 helper function
        function valueBetween(val, v1, v2) {
            var max = Math.max(v1, v2);
            var min = Math.min(v1, v2);
            if (val >= min && val <= max) {
                return true;
            }
            return false;
        }

        const slope = (node2.y - node1.y) / (node2.x - node1.x);
        const yIntercept = node1.y - slope * node1.x;

        var intersections;

        if (node2.x != node1.x) {
            intersections = getCircleLineIntersection(node2, slope, yIntercept);
        } else {
            intersections = [{ x: node2.x, y: node2.y - (node2.size / sizeOffset) }, { x: node2.x, y: node2.y + (node2.size / sizeOffset) }];
        }
        for (const intersection of intersections) {
            if (valueBetween(intersection.x, node1.x, node2.x) && valueBetween(intersection.y, node1.y, node2.y)) {
                return intersection;
            }
        }
    }

    /**
     * Global Graph Related Varialbes declaration
     */

    var element_id;                                     // id of the html tag

    var svg;                                            //support vector graphs elements

    var node_shape;                                     // string, current only support either 'rect' or 'circle', determining the shape of the nodes

    var _theme;                                         // string, the themeData key based on which theme refering to

    /* 
       Whole themeData Object, the key will be the theme, and includes
       background_color: string, the support vector graph colors
       line_color: string, the support vector graph line colors, and for border
       node: object
       node.background_color: string, the node background color (either it is circle or rect)
       node.text_color: string, the node text color
       label: object
       label.background_color: string, the nodeLabels background color (which usually under the nodes)
       label.text_color: string, the node text color
    */
    var _themeData = {
        light: {
            background_color: 'white',
            line_color: 'black',
            node: {
                background_color: 'steelblue',
                text_color: 'black'
            },
            label: {
                background_color: 'white',
                text_color: 'black'
            }
        },
        dark: {
            background_color: '#121212',
            line_color: '#EBEBF5',
            node: {
                background_color: '#229486',
                text_color: 'white'
            },
            label: {
                background_color: 'black',
                text_color: 'white'
            }
        }
    }

    var inputNodes = [];                                // The raw input of the nodes data
    var transformedNodes;                               // The transformed from actual mm dimension to pixel coordinates
    var sizeOffset;                                     // The sizeOffset of the shapes (circle as 1, rect as 2)

    var nodesLabels;                                    // The labels data for the nodes, which is an object {node.id: <string>}
    var nodeLabelGroupElements;                         // The elements reference of the nodeLabel groups

    var nodesLinks;                                     // The links data for the nodes, which is an object {'source': node.id, 'target': node.id }
    var nodeLinkGroupElements;                          // The elements reference of the nodeLinks, which is a line

    var nodesHover;                                     // The hover elements if nodes hover by mouse  {node.id: <string: html>}


    /**
     * updateTheme, by giving either theme, or themeData, change the display based on the given parameters.
     * @param {string} theme 
     * @param {{}} themeData Please refer to sample themeData
     */

    function updateTheme(theme = 'light', themeData = {}) {
        if (svg === undefined) {
            throw new Error('SVG not initialized.  Please ensured you have called drawGraph before running updateNodesLabels');
        }
        _theme = theme;
        if (!(Object.keys(themeData).length === 0)) {
            _themeData = themeData;
        }

        drawTheme();
    }

    /**
     * drawTheme, change the outlook of the svg based on current settings.  If changes needed, refer to updateTheme.
     */
    function drawTheme() {
        d3.select('#' + element_id).selectAll('svg').style('background-color', _themeData[_theme].background_color);
        svg.selectAll('line').attr('stroke', _themeData[_theme].line_color);
        svg.selectAll('marker').attr('fill', _themeData[_theme].line_color);

        svg.selectAll('.node').selectAll(node_shape).attr('fill', _themeData[_theme].node.background_color);
        svg.selectAll('.node').selectAll('text').style('fill', _themeData[_theme].node.text_color);

        nodeLabelGroupElements.selectAll('rect').attr('fill', _themeData[_theme].label.background_color).attr('stroke', _themeData[_theme].line_color);
        nodeLabelGroupElements.selectAll('text').style('fill', _themeData[_theme].label.text_color);

    }

    /**
     * updateNodesLinks, it will change the linkage of the graphs.  Provide the array, and source as start point, target as end point, it will draw an arrow based on the data
     * @param {[{source: node.id<string>, 'target': node.id<string> }]} links 
     */

    function updateNodesLinks(links = []) {
        if (svg === undefined) {
            throw new Error('SVG not initialized.  Please ensured you have called drawGraph before running updateNodesLabels');
        }
        nodesLinks = links;

        drawNodesLinks();
    }

    /**
     * drawNodesLinks, draw all the linkage between all nodes  If changes needed, refer to updateNodesLinks.
     */
    function drawNodesLinks() {
        if (!(nodeLinkGroupElements === undefined)) {
            nodeLinkGroupElements.remove();
        }

        nodeLinkGroupElements = svg.selectAll('.link')
            .data(nodesLinks)
            .enter()
            .append('line')
            .attr('class', 'link')
            .attr('x1', d => findInterceptForDestNode(transformedNodes.find(({ id }) => id === d.target), transformedNodes.find(({ id }) => id === d.source), sizeOffset).x)
            .attr('y1', d => -findInterceptForDestNode(transformedNodes.find(({ id }) => id === d.target), transformedNodes.find(({ id }) => id === d.source), sizeOffset).y)
            .attr('x2', d => findInterceptForDestNode(transformedNodes.find(({ id }) => id === d.source), transformedNodes.find(({ id }) => id === d.target), sizeOffset).x)
            .attr('y2', d => -findInterceptForDestNode(transformedNodes.find(({ id }) => id === d.source), transformedNodes.find(({ id }) => id === d.target), sizeOffset).y)
            .attr('stroke-width', 1)
            .attr('stroke', _themeData[_theme].line_color)
            .attr('marker-end', 'url(#arrow)');
    }

    /**
     * updateNodesLabels, it will change the nodes' labels of the graphs.  Provide the object, it will draw the labels text based on the keys given.  If keys not exist, it will not draw.
     * @param {{node.id: string, labels: string}} links 
     */
    function updateNodesLabels(labels = {}) {
        if (svg === undefined) {
            throw new Error('SVG not initialized.  Please ensured you have called drawGraph before running updateNodesLabels');
        }
        nodesLabels = labels;

        drawNodesLabels();
    }

    /**
     * drawNodesLabels, draw all the labels of the given nodesLabels.  If changes needed, refer to updateNodesLabels.
     */
    function drawNodesLabels() {
        if (!(nodeLabelGroupElements === undefined)) {
            nodeLabelGroupElements.remove();
        }

        nodeLabelGroupElements = svg.selectAll('.nodeLabels')
            .data(transformedNodes.filter(function (d) {
                return !(nodesLabels[d.id] === undefined);
            }))
            .enter()
            .append('g')
            .attr('class', 'nodeLabels')
            .attr('transform', d => `translate(${d.x - Math.min((computeTextSize(nodesLabels[d.id], binarySearchTextFont(nodesLabels[d.id], 20, Math.min(20, d.size / 2), 'height')).width + 10) / 2, d.size)}, ${-(d.y - d.size / 2 - Math.min(d.size / 12, 10))})`);
        nodeLabelGroupElements.append('rect')
            .attr('width', d => Math.min(computeTextSize(nodesLabels[d.id], binarySearchTextFont(nodesLabels[d.id], 20, Math.min(20, d.size / 2), 'height')).width + 10, d.size * 2))
            .attr('height', d => Math.min(20, d.size / 2))
            .attr('fill', _themeData[_theme].label.background_color)
            .attr('stroke', _themeData[_theme].line_color);
        nodeLabelGroupElements.append('text')
            .attr('text-anchor', 'middle')
            .attr('dy', '.35em')
            .style('font-size', d => Math.min(binarySearchTextFont(nodesLabels[d.id], 20, Math.min(20, d.size / 2), 'height'), binarySearchTextFont(nodesLabels[d.id], 20, d.size * 2, 'width')))
            .attr('x', d => Math.min((computeTextSize(nodesLabels[d.id], binarySearchTextFont(nodesLabels[d.id], 20, Math.min(20, d.size / 2), 'height')).width + 10) / 2, d.size))
            .attr('y', d => Math.min(20, d.size / 2) / 2)
            .style('fill', _themeData[_theme].label.text_color)
            .text(d => nodesLabels[d.id]);
    }

    /**
     * updateNodesHoverHTML, it will change the nodes' hover element.  
     * If it is null, then data from inputNodes will be displayed.  
     * If the key exist, it will display a box with the given html.
     * If the key not exist, it will not display when hover.
     * @param {{node.id: string, html: string}} links 
     */

    function updateNodesHoverHTML(htmls = {}) {
        if (svg === undefined) {
            throw new Error('SVG not initialized.  Please ensured you have called drawGraph before running updateNodesLabels');
        }

        nodesHover = htmls;
    }

    function drawGraph(id, options = {}) {

        element_id = id;

        const NODE_SIZE = (options.node_size === undefined) ? 10 : options.node_size;
        node_shape = (options.shape === undefined) ? 'circle' : options.shape;

        sizeOffset = 1;
        switch (node_shape) {
            case 'circle':
                sizeOffset = 1;
                break;
            case 'rect':
                sizeOffset = 2;
                break;
        }

        function mm2pixel(val, canvas_dimension, actual_dimension) {
            return val * canvas_dimension / actual_dimension;
        }

        function getMaxDiff(arr, key) {
            var min;
            var max;
            for (var i = 0; i < arr.length; i++) {
                var size = ((arr[i]['size'] === undefined) ? NODE_SIZE : arr[i]['size']);
                if (max == null || parseInt(arr[i][key]) > parseInt(max))
                    max = arr[i][key] + size;
                if (min == null || parseInt(arr[i][key]) < parseInt(min))
                    min = arr[i][key] - size;
            }
            return max - min;
        }

        var graph_div = document.getElementById(element_id);

        const element_size = {
            width: (options.element_dimension === undefined || options.element_dimension.width === undefined) ? graph_div.clientWidth : options.element_dimension.width,
            height: (options.element_dimension === undefined || options.element_dimension.height === undefined) ? graph_div.clientHeight : options.element_dimension.height
        };

        const landscape = (element_size.width > element_size.height);

        inputNodes = (options.nodes === undefined) ? [] : options.nodes;

        var tmp_actual_size = {
            width: (options.actual_dimension === undefined || options.actual_dimension.width === undefined) ? getMaxDiff(inputNodes, 'x') + 150 : options.actual_dimension.width,
            height: (options.actual_dimension === undefined || options.actual_dimension.height === undefined) ? getMaxDiff(inputNodes, 'y') + 150 : options.actual_dimension.height
        };

        const actual_size = {
            width: (landscape == true) ? (element_size.width * tmp_actual_size.height) / element_size.height : tmp_actual_size.width,
            height: (landscape == true) ? tmp_actual_size.height : (element_size.height * tmp_actual_size.width) / element_size.width,
        }

        transformedNodes = [];
        // Define sample data
        inputNodes.forEach(element => {
            var ele = JSON.parse(JSON.stringify(element));
            ele.size = mm2pixel(((ele.size === undefined) ? NODE_SIZE : ele.size), element_size.width, actual_size.width);
            ele.x = mm2pixel(ele.x, element_size.width, actual_size.width);
            ele.y = mm2pixel(ele.y, element_size.height, actual_size.height);
            transformedNodes.push(ele);
        });

        _theme = (options.theme === undefined) ? 'light' : options.theme;
        _themeData = (options.themeData === undefined) ? _themeData : options.themeData;
        nodesLinks = (options.links === undefined) ? [] : options.links;
        nodesLabels = (options.labels === undefined) ? {} : options.labels;

        // Create an SVG container
        svg = d3.select('#' + element_id)
            .append('svg')
            .attr('viewBox', `0 0 ${element_size.width} ${element_size.height}`)
            .call(d3.zoom().on('zoom', zoomed))
            .append('g')
            .attr('transform', `translate(${element_size.width / 2}, ${element_size.height / 2})`);

        // Create arrow markers
        svg.append('defs').selectAll('marker')
            .data(['arrow'])
            .enter()
            .append('marker')
            .attr('id', d => d)
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', mm2pixel(actual_size.width * 0.01, element_size.width, actual_size.width))
            .attr('refY', 0)
            .attr('markerWidth', mm2pixel(actual_size.width * 0.01, element_size.width, actual_size.width))
            .attr('markerHeight', mm2pixel(actual_size.height * 0.01, element_size.height, actual_size.height))
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('class', 'arrow');


        // Create links
        updateNodesLinks(nodesLinks);

        // Create nodes
        const nodeGroup = svg.selectAll('.node')
            .data(transformedNodes)
            .enter()
            .append('g')
            .attr('class', 'node')
            .style('opacity', 0.9)
            .attr('transform', d => `translate(${d.x}, ${-d.y})`);

        if (node_shape == 'rect') {
            nodeGroup.append('rect')
                .attr('rx', d => d.size / 4)
                .attr('ry', d => d.size / 4)
                .attr('x', d => -d.size)
                .attr('y', d => -d.size / 2)
                .attr('width', d => d.size * 2)
                .attr('height', d => d.size)
                .attr('fill', _themeData[_theme].node.background_color);
        } else {
            nodeGroup.append('circle')
                .attr('r', d => d.size)
                .attr('fill', _themeData[_theme].node.text_color);
        }
        // Display the node ID
        nodeGroup.append('text')
            .attr('text-anchor', 'middle')
            .style('font-size', d => binarySearchTextFont(d.id, d.size, d.size * 2 - d.size * 0.4, 'width'))
            .attr('dy', '.35em')
            .text(d => d.id);

        // Create nodes labels
        updateNodesLabels(nodesLabels);

        var tooltip = d3.select('#' + id)
            .append('div')
            .attr('class', 'tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background-color', 'white')
            .style('border', 'solid')
            .style('border-width', '2px')
            .style('border-radius', '5px')
            .style('padding', '5px');

        nodeGroup
            .on('mouseenter', function (event, d) {
                var text = '';

                d3.select(this)
                    .selectAll(node_shape)
                    .style('stroke', _themeData[_theme].line_color)
                    .style('opacity', 1);

                if (nodesHover == null) {
                    const node = inputNodes.find(({ id }) => id === d.id);

                    for (const property in node) {
                        text += property + ': ' + node[property] + '<br>';
                    }
                } else {
                    if (!nodesHover.hasOwnProperty(d.id)) {
                        console.log('There is no hover html in ' + d.id);
                        return;
                    }
                    text = nodesHover[d.id];
                }
                tooltip.style('visibility', 'visible')
                    .style('top', (event.pageY) + 'px')
                    .style('left', (event.pageX) + 'px').html(text);


            })
            .on('mouseleave', function (event, d) {
                tooltip.style('visibility', 'hidden');
                d3.select(this)
                    .selectAll(node_shape)
                    .style('stroke', 'none')
                    .style('opacity', 0.9);
            });

        updateTheme(_theme);


        // Zoom and translate function
        function zoomed(event) {
            svg.attr('transform', event.transform);
        }
    }

    return {
        drawGraph: drawGraph,
        updateNodesLabels: updateNodesLabels,
        updateNodesLinks: updateNodesLinks,
        updateTheme: updateTheme,
        updateNodesHoverHTML: updateNodesHoverHTML
    };
})();