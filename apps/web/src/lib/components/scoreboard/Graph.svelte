<script lang="ts" module>
  export interface TeamChartData {
    name: string;
    data: Array<[number, number]>; // [timestamp, score]
  }
</script>

<script lang="ts">
  import { onMount } from "svelte";
  import Chart from "chart.js/auto";
  import {
    TimeScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
  } from "chart.js";
  import "chartjs-adapter-date-fns";

  export let data: TeamChartData[] = [];

  // TODO: better configuration of colours
  const lineColours: string[] = [
    "#9966FF",
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#4BC0C0",
    "#FF9F40",
    "#8CD867",
    "#EA526F",
    "#23395B",
    "#A0A0A0",
  ];

  let teamsData: TeamChartData[] = data;

  let chartContainer: HTMLCanvasElement;
  let scoreboardChart: Chart;

  function prepareChartData() {
    const datasets = teamsData.map((team, index) => {
      return {
        label: team.name,
        data: team.data.map(([timestamp, score]) => ({
          x: timestamp,
          y: score,
        })),
        borderColor: lineColours[index % lineColours.length],
        backgroundColor: lineColours[index % lineColours.length],
        tension: 0,
        pointRadius: 0,
        pointHoverRadius: 5,
      };
    });

    return { datasets };
  }

  onMount(() => {
    Chart.register(
      TimeScale,
      LinearScale,
      PointElement,
      LineElement,
      Title,
      Tooltip,
      Legend,
    );

    const ctx = chartContainer.getContext("2d");

    if (!ctx) {
      console.error("Canvas context not available");
      return;
    }

    scoreboardChart = new Chart(ctx, {
      type: "line",
      data: prepareChartData(),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: "time",
            time: {
              unit: "hour",
              displayFormats: {
                minute: "dd/MM HH:mm",
                hour: "dd/MM HH:mm",
              },
              tooltipFormat: "MMM dd yyyy h:mm a",
            },
            title: {
              display: false,
            },
            grid: {
              display: true,
            },
            ticks: {
              source: "auto",
              stepSize: 60,
              maxRotation: 0,
              minRotation: 0,
            },
          },
          y: {
            title: {
              display: false,
            },
            grid: {
              display: true,
            },
            beginAtZero: true,
          },
        },
        interaction: {
          mode: "index",
          intersect: false,
          // @ts-expect-error: chartjs
          itemSort: function (a, b) {
            return (b.raw.y as number) - (a.raw.y as number);
          },
        },
        plugins: {
          tooltip: {
            mode: "index",
            intersect: false,
          },
          legend: {
            position: "top",
            labels: {
              boxWidth: 25,
              borderRadius: 2,
              useBorderRadius: true,
            },
          },
          title: {
            display: false,
          },
        },
      },
    });

    return () => {
      if (scoreboardChart) {
        scoreboardChart.destroy();
      }
    };
  });
</script>

<div class="card bg-base-100 pop w-full mb-32 p-6 max-h-[70%]">
  <canvas bind:this={chartContainer}></canvas>
</div>
