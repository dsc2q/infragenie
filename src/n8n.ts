export function generateN8nWorkflow(endpoints: string[], projectName = 'Local App'): string {
  const nodes: any[] = [];
  const connections: Record<string, any> = {};

  // 1. Add Manual Trigger
  const triggerNodeName = 'Trigger API Tests';
  nodes.push({
    parameters: {},
    id: 'manual-trigger-id',
    name: triggerNodeName,
    type: 'n8n-nodes-base.manualTrigger',
    typeVersion: 1,
    position: [100, 300],
  });

  connections[triggerNodeName] = {
    main: [[]],
  };

  let lastNodeName = triggerNodeName;
  let posX = 300;

  // 2. Add HTTP Request nodes for each endpoint
  endpoints.forEach((endpoint, idx) => {
    // Sanitize node name
    const nodeName = `Test ${endpoint.replace(/[^a-zA-Z0-9]/g, ' ').trim() || 'Root'}`;
    const uniqueName = nodes.some(n => n.name === nodeName) ? `${nodeName} (${idx})` : nodeName;

    nodes.push({
      parameters: {
        url: `http://localhost:3000${endpoint}`,
        options: {},
      },
      id: `http-request-id-${idx}`,
      name: uniqueName,
      type: 'n8n-nodes-base.httpRequest',
      typeVersion: 4.1,
      position: [posX, 300],
    });

    // Link last node to this node
    connections[lastNodeName].main[0].push({
      node: uniqueName,
      type: 'main',
      index: 0,
    });

    // Prepare connection entry for this node
    connections[uniqueName] = {
      main: [[]],
    };

    lastNodeName = uniqueName;
    posX += 200;
  });

  const workflow = {
    name: `InfraGenie - ${projectName} API Test Suite`,
    nodes,
    connections,
    active: false,
    settings: {
      executionOrder: 'v1',
    },
  };

  return JSON.stringify(workflow, null, 2);
}
