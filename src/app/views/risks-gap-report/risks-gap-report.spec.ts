import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RisksGapReport } from './risks-gap-report';

describe('RisksGapReport', () => {
  let component: RisksGapReport;
  let fixture: ComponentFixture<RisksGapReport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RisksGapReport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RisksGapReport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
