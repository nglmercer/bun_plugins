
import { getDiagnosticsForText } from "./src/lsp/diagnostics";

const yaml = `
- id: "qweqwe"
  on: test123
  if:
    field: data.test
    operator: RANGE
    value: qweqweqwe
  do:
    type: test123
    params:
      key: qweqwe
      value: true
- id: check-range
  on: TEST_EVENT
  if:
    field: data.number
    operator: RANGE
    value: asdasdasdasd
  do:
    type: log
    params:
      message: hello
`;

async function test() {
    const diagnostics = await getDiagnosticsForText(yaml);
    console.log(JSON.stringify(diagnostics, null, 2));
}

test();
