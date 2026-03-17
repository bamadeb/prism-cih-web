import { ComponentFixture, TestBed } from '@angular/core/testing';

import { OutreachActivity } from './outreach-activity';

describe('OutreachActivity', () => {
  let component: OutreachActivity;
  let fixture: ComponentFixture<OutreachActivity>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [OutreachActivity]
    })
    .compileComponents();

    fixture = TestBed.createComponent(OutreachActivity);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
