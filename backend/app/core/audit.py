import hashlib, json
from sqlalchemy.orm import Session
from app.models.entities import AuditEvent

def write_event(db: Session, project_id: str, event_type: str, entity_type: str,
                entity_id: str | None = None, payload: dict | None = None):
    previous = db.query(AuditEvent).filter_by(project_id=project_id).order_by(AuditEvent.created_at.desc()).first()
    previous_hash = previous.event_hash if previous else "GENESIS"
    body = {
        "project_id": project_id, "event_type": event_type, "entity_type": entity_type,
        "entity_id": entity_id, "payload": payload or {}, "previous_hash": previous_hash
    }
    event_hash = hashlib.sha256(json.dumps(body, sort_keys=True, default=str).encode()).hexdigest()
    event = AuditEvent(**body, event_hash=event_hash)
    db.add(event)
    db.flush()
    return event

def verify_chain(db: Session, project_id: str) -> dict:
    events = db.query(AuditEvent).filter_by(project_id=project_id).order_by(AuditEvent.created_at.asc()).all()
    previous_hash = "GENESIS"
    for index, event in enumerate(events):
        body = {
            "project_id": event.project_id, "event_type": event.event_type,
            "entity_type": event.entity_type, "entity_id": event.entity_id,
            "payload": event.payload or {}, "previous_hash": previous_hash
        }
        expected = hashlib.sha256(json.dumps(body, sort_keys=True, default=str).encode()).hexdigest()
        if event.previous_hash != previous_hash or event.event_hash != expected:
            return {"valid": False, "events": len(events), "broken_at": index}
        previous_hash = event.event_hash
    return {"valid": True, "events": len(events)}
