from app.engines.validation import validate_artifact

def test_invalid_workflow_dangling_edge_is_flagged():
    issues = validate_artifact("workflow", {
        "nodes": [{"id":"start","type":"trigger","label":"Start"}],
        "edges": [{"source":"start","target":"missing"}]
    })
    assert any(issue["code"] == "DANGLING_EDGE" for issue in issues)

def test_valid_workflow_has_no_issues():
    issues = validate_artifact("workflow", {
        "nodes": [{"id":"start"},{"id":"end"}],
        "edges": [{"source":"start","target":"end"}]
    })
    assert issues == []
