import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Logreport } from './logreport';

describe('Logreport', () => {
  let component: Logreport;
  let fixture: ComponentFixture<Logreport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Logreport]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Logreport);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
