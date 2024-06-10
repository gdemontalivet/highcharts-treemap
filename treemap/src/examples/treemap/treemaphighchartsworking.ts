import * as Highcharts from 'highcharts';
import HighchartsTreemap from 'highcharts/modules/treemap';
import HighchartsMore from 'highcharts/highcharts-more';

// Initialize Highcharts modules
HighchartsTreemap(Highcharts);
HighchartsMore(Highcharts);

interface Looker {
  plugins: {
    visualizations: {
      add: (visualization: VisualizationDefinition) => void
    }
  }
}

interface VisualizationDefinition {
  id?: string;
  label?: string;
  options: VisOptions;
  addError?: (error: VisualizationError) => void;
  clearErrors?: (errorName?: string) => void;
  create: (element: HTMLElement, settings: VisConfig) => void;
  trigger?: (event: string, config: object[]) => void;
  update?: (data: VisData, element: HTMLElement, config: VisConfig, queryResponse: VisQueryResponse, details?: VisUpdateDetails) => void;
  updateAsync?: (data: VisData, element: HTMLElement, config: VisConfig, queryResponse: VisQueryResponse, details: VisUpdateDetails | undefined, updateComplete: () => void) => void;
  destroy?: () => void;
}

interface VisOptions {
  [optionName: string]: VisOption;
}

interface VisOption {
  type: string;
  values?: VisOptionValue[];
  display?: string;
  default?: any;
  label: string;
  section?: string;
  placeholder?: string;
  display_size?: 'half' | 'third' | 'normal';
  order?: number;
  min?: number;
  max?: number;
  step?: number;
  required?: boolean;
  supports?: string[];
}

interface VisOptionValue {
  [label: string]: string;
}

interface VisQueryResponse {
  [key: string]: any;
  data: VisData;
  fields: {
    [key: string]: any[];
  };
  pivots: Pivot[];
}

interface Pivot {
  key: string;
  is_total: boolean;
  data: { [key: string]: string };
  metadata: { [key: string]: { [key: string]: string } };
}

interface VisConfig {
  [key: string]: VisConfigValue;
}

type VisConfigValue = any;

interface VisUpdateDetails {
  changed: {
    config?: string[];
    data?: boolean;
    queryResponse?: boolean;
    size?: boolean;
  };
}

interface VisData extends Array<Row> { }

interface Row {
  [fieldName: string]: PivotCell | Cell;
}

interface PivotCell {
  [pivotKey: string]: Cell;
}

interface Cell {
  [key: string]: any;
  value: any;
  rendered?: string;
  html?: string;
  links?: Link[];
}

interface Link {
  label: string;
  type: string;
  type_label: string;
  url: string;
}

interface VisualizationError {
  group?: string;
  message?: string;
  title?: string;
  retryable?: boolean;
  warning?: boolean;
}

declare var looker: Looker;

interface TreemapVisualization extends VisualizationDefinition {
  chart?: Highcharts.Chart
}

const vis: TreemapVisualization = {
  id: 'treemap',
  label: 'Treemap',
  options: {
    color_range: {
      type: 'array',
      label: 'Color Range',
      display: 'colors',
      default: ['#dd3333', '#80ce5d', '#f78131', '#369dc1', '#c572d3', '#36c1b3', '#b57052', '#ed69af']
    }
  },
  create: function (element, config) {
    this.chart = Highcharts.chart(element, {
      series: [{
        type: 'treemap',
        layoutAlgorithm: 'squarified',
        data: []
      }],
      title: {
        text: 'Treemap'
      },
      credits: {
        enabled: false
      }
    });
  },
  update: function (data, element, config, queryResponse) {
    if (!handleErrors(this, queryResponse, {
      min_pivots: 0, max_pivots: 0,
      min_dimensions: 1, max_dimensions: undefined,
      min_measures: 1, max_measures: 1
    })) return;

    const dimensions = queryResponse.fields.dimension_like;
    const measure = queryResponse.fields.measure_like[0];

    const format = formatType(measure.value_format) || ((s: any): string => s.toString());

    const colorRange = config.color_range;

    // Prepare data for Highcharts treemap
    const treemapData = data.map((row: Row) => {
      const name = dimensions.map((dimension) => row[dimension.name]?.value ?? 'N/A').join(' - ');
      const value = row[measure.name]?.value ?? 0;
      return {
        name: name,
        value: value,
        color: colorRange[Math.floor(Math.random() * colorRange.length)]
      };
    });

    if (this.chart) {
      this.chart.update({
        series: [{
          type: 'treemap',
          layoutAlgorithm: 'squarified',
          data: treemapData
        }]
      });
    }
  }
};

looker.plugins.visualizations.add(vis);

// Helper functions

export const formatType = (valueFormat: string) => {
  if (!valueFormat) return undefined;
  let format = '';
  switch (valueFormat.charAt(0)) {
    case '$':
      format += '$'; break;
    case '£':
      format += '£'; break;
    case '€':
      format += '€'; break;
  }
  if (valueFormat.indexOf(',') > -1) {
    format += ',';
  }
  const splitValueFormat = valueFormat.split('.');
  format += '.';
  format += splitValueFormat.length > 1 ? splitValueFormat[1].length : 0;

  switch (valueFormat.slice(-1)) {
    case '%':
      format += '%'; break;
    case '0':
      format += 'f'; break;
  }

  // Use Highcharts number formatting
  return (value: number) => Highcharts.numberFormat(value, format.length ? format.split('.')[1]?.length || 0 : 0);
};

export const handleErrors = (vis: VisualizationDefinition, res: VisQueryResponse, options: VisConfig) => {
  const check = (group: string, noun: string, count: number, min: number, max: number): boolean => {
    if (!vis.addError || !vis.clearErrors) return false;
    if (count < min) {
      vis.addError({
        title: `Not Enough ${noun}s`,
        message: `This visualization requires ${min === max ? 'exactly' : 'at least'} ${min} ${noun.toLowerCase()}${ min === 1 ? '' : 's' }.`,
        group
      });
      return false;
    }
    if (count > max) {
      vis.addError({
        title: `Too Many ${noun}s`,
        message: `This visualization requires ${min === max ? 'exactly' : 'no more than'} ${max} ${noun.toLowerCase()}${ min === 1 ? '' : 's' }.`,
        group
      });
      return false;
    }
    vis.clearErrors(group);
    return true;
  };

  const { pivots, dimensions, measure_like: measures } = res.fields;

  return (
    check('pivot-req', 'Pivot', pivots.length, options.min_pivots, options.max_pivots) &&
    check('dim-req', 'Dimension', dimensions.length, options.min_dimensions, options.max_dimensions) &&
    check('mes-req', 'Measure', measures.length, options.min_measures, options.max_measures)
  );
};

function burrow(table: Row[]) {
  const obj: any = {};
  table.forEach((row: Row) => {
    let layer = obj;
    row.taxonomy.value.forEach((key: any) => {
      layer[key] = key in layer ? layer[key] : {};
      layer = layer[key];
    });
    layer.__data = row;
  });

  return {
    name: 'root',
    children: descend(obj, 1),
    depth: 0
  };
}

function descend(obj: any, depth: number = 0) {
  const arr: any[] = [];
  for (const k in obj) {
    if (k === '__data') {
      continue;
    }
    const child: any = {
      name: k,
      depth,
      children: descend(obj[k], depth + 1)
    };
    if ('__data' in obj[k]) {
      child.data = obj[k].__data;
    }
    arr.push(child);
  }
  return arr;
}