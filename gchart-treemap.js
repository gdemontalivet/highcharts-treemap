const visObject = {
  options: {
    title: {
      type: "string",
      label: "Chart Title",
      default: "Custom Treemap"
    }
  },

  create: function(element, config){
    element.innerHTML = "<div id='chart_div' style='width: 100%; height: 500px;'></div>";
    google.charts.load('current', {'packages':['treemap']});
  },

  updateAsync: function(data, element, config, queryResponse, details, doneRendering){
    google.charts.setOnLoadCallback(drawChart);

    function drawChart() {
      var dataTable = new google.visualization.DataTable();
      dataTable.addColumn('string', 'ID');
      dataTable.addColumn('string', 'Parent');
      dataTable.addColumn('number', 'Value');
      dataTable.addColumn('number', 'Color');

      const formattedData = [];
      const rootId = 'Root';
      formattedData.push([rootId, null, 0, 0]);

      if (queryResponse.fields.dimensions.length < 2 || queryResponse.fields.measures.length < 1) {
        console.error('Expected at least 2 dimensions and 1 measure');
        element.innerHTML = "<div style='color: red; font-weight: bold;'>Error: The visualization expects at least 2 dimensions and 1 measure.</div>";
        doneRendering();
        return;
      }

      const dimension1 = queryResponse.fields.dimensions[0].name;
      const dimension2 = queryResponse.fields.dimensions[1].name;
      const measure = queryResponse.fields.measures[0].name;
      const colorMeasure = queryResponse.fields.measures[1] ? queryResponse.fields.measures[1].name : measure;

      data.forEach(function(row) {
        if (row[dimension1] && row[dimension2] && row[measure]) {
          const friendlyClass = row[dimension1].value;
          const opponentClass = row[dimension2].value;
          const count = row[measure].value;
          const color = row[colorMeasure].value;

          formattedData.push([`${friendlyClass}-${opponentClass}`, friendlyClass, count, color]);
          formattedData.push([friendlyClass, rootId, null, null]);
        } else {
          console.warn('Skipping row due to missing data', row);
        }
      });

      const uniqueData = Array.from(new Set(formattedData.map(JSON.stringify))).map(JSON.parse);
      uniqueData.forEach(row => dataTable.addRow(row));

      var options = {
        title: config.title,
        highlightOnMouseOver: true,
        maxDepth: 2,
        maxPostDepth: 3,
        minHighlightColor: '#8c6bb1',
        midHighlightColor: '#9ebcda',
        maxHighlightColor: '#edf8fb',
        minColor: '#009688',
        midColor: '#f7f7f7',
        maxColor: '#ee8100',
        headerHeight: 15,
        showScale: true,
        useWeightedAverageForAggregation: true
      };

      var chart = new google.visualization.TreeMap(document.getElementById('chart_div'));
      chart.draw(dataTable, options);

      doneRendering();
    }
  }
};

looker.plugins.visualizations.add(visObject);
