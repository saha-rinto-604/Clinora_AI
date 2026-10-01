import json
import logging
import threading

import httpx
import pytest

from app.model_runtime import MedGemmaRuntime, ModelGeneration, ModelTimeoutError, safe_generation_timings
from app.services.report_analysis_service import InvalidModelOutputError, ReportAnalysisService
from tests.test_report_analysis_service import SequenceRuntime, request_with_observation, safe_payload


def events(caplog):
    return [json.loads(record.message) for record in caplog.records
            if record.name == 'app.services.patient_analysis_metrics']


@pytest.mark.parametrize('repair', [False, True])
def test_metrics_measure_bounded_generation_without_changing_result(caplog, repair):
    request, observation_id = request_with_observation()
    payload = safe_payload(observation_id)
    valid = ModelGeneration(json.dumps(payload), 'stop', 200, 500,
                            timings={'prompt_ms': 20, 'predicted_ms': 100, 'private': 'report content'})
    outputs = [ModelGeneration('not json', 'stop', 10, 500), valid] if repair else [valid]
    runtime = SequenceRuntime(outputs)
    with caplog.at_level(logging.INFO):
        result = ReportAnalysisService(runtime).analyze(request)
    expected = ReportAnalysisService(SequenceRuntime([payload])).analyze(request)
    assert result == expected
    event = events(caplog)[0]
    assert event['generation_call_count'] == len(outputs)
    assert event['repair_attempted'] is repair
    assert event['completion_tokens'] == (210 if repair else 200)
    assert event['prompt_tokens'] == (1000 if repair else 500)
    assert event['finish_reason'] == 'stop'
    assert event['grounding_validation_ms'] > 0
    assert event['total_ms'] >= event['inference_duration_ms']
    assert (event['repair_duration_ms'] > 0) is repair
    assert 'private' not in json.dumps(event)
    assert 'Hemoglobin' not in json.dumps(event)
    assert str(observation_id) not in json.dumps(event)


def test_timeout_emits_count_and_duration_without_raw_exception(caplog):
    request, _ = request_with_observation()
    class TimeoutRuntime:
        def generate(self, *args, **kwargs):
            raise ModelTimeoutError('private report content')
    with caplog.at_level(logging.INFO), pytest.raises(ModelTimeoutError):
        ReportAnalysisService(TimeoutRuntime()).analyze(request)
    event = events(caplog)[0]
    assert event['outcome'] == 'failed'
    assert event['generation_call_count'] == 1
    assert event['prompt_tokens'] is None
    assert event['inference_duration_ms'] > 0
    assert 'private' not in caplog.text


def test_truncation_still_does_not_repair(caplog):
    request, _ = request_with_observation()
    runtime = SequenceRuntime([ModelGeneration('private', 'length', 3072, 500)])
    with caplog.at_level(logging.INFO), pytest.raises(InvalidModelOutputError):
        ReportAnalysisService(runtime).analyze(request)
    event = events(caplog)[0]
    assert event['generation_call_count'] == 1
    assert event['repair_attempted'] is False
    assert event['finish_reason'] == 'length'


def test_semaphore_wait_is_separate_from_inference(caplog):
    request, observation_id = request_with_observation()
    service = ReportAnalysisService(SequenceRuntime([safe_payload(observation_id)]))
    service._semaphore.acquire()
    timer = threading.Timer(0.06, service._semaphore.release)
    with caplog.at_level(logging.INFO):
        timer.start()
        service.analyze(request)
    timer.join()
    event = events(caplog)[0]
    assert event['queue_wait_ms'] >= 30
    assert event['inference_duration_ms'] < event['queue_wait_ms']


def test_runtime_collects_only_safe_numeric_timings():
    timing = {'prompt_ms': 21, 'predicted_ms': 90, 'predicted_per_second': 8.5,
              'prompt_n': 'private', 'cache_n': True, 'predicted_n': float('nan'), 'report': 'private'}
    handler = lambda request: httpx.Response(200, json={
        'choices': [{'message': {'content': '{}'}, 'finish_reason': 'stop'}],
        'timings': {key: value for key, value in timing.items() if key != 'predicted_n'},
    })
    with httpx.Client(base_url='http://localhost', transport=httpx.MockTransport(handler)) as client:
        generation = MedGemmaRuntime(client).generate([{'role': 'user', 'content': 'fixture'}])
    expected = {'prompt_ms': 21.0, 'predicted_ms': 90.0, 'predicted_per_second': 8.5}
    assert generation.timings == expected
    assert safe_generation_timings(timing) == expected
