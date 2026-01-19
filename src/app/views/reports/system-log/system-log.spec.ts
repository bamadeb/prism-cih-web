import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SystemLog } from './system-log';

describe('SystemLog', () => {
  let component: SystemLog;
  let fixture: ComponentFixture<SystemLog>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SystemLog]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SystemLog);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
